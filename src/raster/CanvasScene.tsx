// src/raster/CanvasScene.tsx
import { useEffect, useRef } from 'react';
import { RasterRenderer, LineAlg } from './RasterRenderer';
import {
    Shape,
    Rect,
    Line,
    Oval,
    Triangle,
    QuadraticBezier,
    CubicBezier,
    PathBezier,
} from '../shapes';
import { Bounds } from '../shapes/types';

type Point = { x: number; y: number };
type EditorMode = 'idle' | 'move' | 'resize' | 'rotate' | 'edit-point';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface EditorState {
    mode: EditorMode;
    shapes: Shape[];
    selected: Shape | null;
    selectedHandle: ResizeHandle | null;
    selectedPointIndex: number | null;
    dragStart: Point | null;
    startTransform: {
        x: number;
        y: number;
        rotation: number;
        scaleX: number;
        scaleY: number;
    } | null;
    startLocalBounds: Bounds | null;
    startScaleX: number;
    startScaleY: number;
    startAngle: number | null;
    rotateModeActive: boolean;
}

interface CanvasSceneProps {
    lineAlg: LineAlg;
    projectId?: string;
    onShapesChange?: (shapes: Shape[]) => void;
    onSelectedChange?: (selected: Shape | null) => void;
    addPointMode?: boolean;
    removePointMode?: boolean;
    onAddPointModeChange?: (value: boolean) => void;
    onRemovePointModeChange?: (value: boolean) => void;
}

export const CanvasScene = ({
    lineAlg,
    onShapesChange,
    onSelectedChange,
    addPointMode = false,
    removePointMode = false,
    onAddPointModeChange,
    onRemovePointModeChange,
}: CanvasSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<RasterRenderer | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const editorRef = useRef<EditorState>({
        mode: 'idle',
        shapes: [],
        selected: null,
        selectedHandle: null,
        selectedPointIndex: null,
        dragStart: null,
        startTransform: null,
        startLocalBounds: null,
        startScaleX: 1,
        startScaleY: 1,
        startAngle: null,
        rotateModeActive: false,
    });

    // ========== Вспомогательные функции ==========
    const getScenePoint = (e: PointerEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const hitTestAll = (x: number, y: number): Shape | null => {
        const { shapes } = editorRef.current;
        for (let i = shapes.length - 1; i >= 0; i--) {
            // Добавим проверку, чтобы убедиться, что фигура вообще способна на hitTest
            if (shapes[i].hitTest(x, y)) {
                return shapes[i];
            }
        }
        return null;
    };

    const getLocalBoundsNoPadding = (shape: Shape): Bounds | null => shape.getLocalBounds();

    const getLocalBoundsPadded = (shape: Shape) => {
        const localBounds = getLocalBoundsNoPadding(shape);
        if (!localBounds) return null;
        const padding = 10;
        return {
            minX: localBounds.minX - padding,
            minY: localBounds.minY - padding,
            maxX: localBounds.maxX + padding,
            maxY: localBounds.maxY + padding,
        };
    };

    const localToWorld = (shape: Shape, localX: number, localY: number): Point => {
        const [x, y] = shape.transformPointToDevice(localX, localY);
        return { x, y };
    };

    const worldToLocal = (shape: Shape, worldX: number, worldY: number): Point | null => {
        const p = shape.transformPointToLocal(worldX, worldY);
        if (!p) return null;
        return { x: p[0], y: p[1] };
    };

    const getLocalResizeHandles = (shape: Shape): Record<ResizeHandle, Point> => {
        const localBounds = getLocalBoundsPadded(shape);
        if (!localBounds) throw new Error('No bounds');
        const cx = (localBounds.minX + localBounds.maxX) / 2;
        const cy = (localBounds.minY + localBounds.maxY) / 2;
        const handleOffset = 10;
        return {
            nw: { x: localBounds.minX - handleOffset, y: localBounds.minY - handleOffset },
            n: { x: cx, y: localBounds.minY - handleOffset },
            ne: { x: localBounds.maxX + handleOffset, y: localBounds.minY - handleOffset },
            e: { x: localBounds.maxX + handleOffset, y: cy },
            se: { x: localBounds.maxX + handleOffset, y: localBounds.maxY + handleOffset },
            s: { x: cx, y: localBounds.maxY + handleOffset },
            sw: { x: localBounds.minX - handleOffset, y: localBounds.maxY + handleOffset },
            w: { x: localBounds.minX - handleOffset, y: cy },
        };
    };

    const getResizeHandleAtPoint = (
        shape: Shape,
        worldX: number,
        worldY: number,
    ): ResizeHandle | null => {
        const localP = worldToLocal(shape, worldX, worldY);
        if (!localP) return null;
        const localHandles = getLocalResizeHandles(shape);
        for (const [name, pos] of Object.entries(localHandles)) {
            const worldPos = localToWorld(shape, pos.x, pos.y);
            if (Math.hypot(worldX - worldPos.x, worldY - worldPos.y) <= 12)
                return name as ResizeHandle;
        }
        return null;
    };

    const isRotateHandleAtPoint = (shape: Shape, worldX: number, worldY: number): boolean => {
        const localBounds = getLocalBoundsPadded(shape);
        if (!localBounds) return false;
        const rotRadius = 12;
        const cx = (localBounds.minX + localBounds.maxX) / 2;
        const rotLocalY = localBounds.minY - rotRadius - 5;
        const rotLocal = { x: cx, y: rotLocalY };
        const rotWorld = localToWorld(shape, rotLocal.x, rotLocal.y);
        return Math.hypot(worldX - rotWorld.x, worldY - rotWorld.y) <= rotRadius;
    };

    // ========== Контрольные точки ==========
    const getControlPointAt = (shape: Shape, worldX: number, worldY: number): number | null => {
        // Проверяем, есть ли у фигуры метод getControlPoints и возвращает ли он не null
        if (!('getControlPoints' in shape)) return null;
        const cps = (shape as any).getControlPoints();
        if (!cps || !cps.length) return null;
        for (let i = 0; i < cps.length; i++) {
            const [sx, sy] = shape.transformPointToDevice(cps[i].x, cps[i].y);
            if (Math.hypot(worldX - sx, worldY - sy) <= 12) return i;
        }
        return null;
    };

    const updateCursor = (x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const editor = editorRef.current;
        if (editor.selected) {
            if (isRotateHandleAtPoint(editor.selected, x, y)) {
                canvas.style.cursor = 'grab';
                return;
            }
            if (getResizeHandleAtPoint(editor.selected, x, y)) {
                canvas.style.cursor = 'nw-resize';
                return;
            }
            if (getControlPointAt(editor.selected, x, y) !== null) {
                canvas.style.cursor = 'move';
                return;
            }
            if (editor.selected.hitTest(x, y)) {
                canvas.style.cursor = 'grab';
                return;
            }
        }
        canvas.style.cursor = 'default';
    };

    // ========== Отрисовка выделения ==========
    const drawSelection = (r: RasterRenderer, shape: Shape) => {
        const localBounds = getLocalBoundsPadded(shape);
        if (!localBounds) return;

        const handleSize = 10;
        const rotRadius = 12;

        // Рамка
        const rectLocal = [
            { x: localBounds.minX, y: localBounds.minY },
            { x: localBounds.maxX, y: localBounds.minY },
            { x: localBounds.maxX, y: localBounds.maxY },
            { x: localBounds.minX, y: localBounds.maxY },
        ];
        const rectWorld = rectLocal.map((p) => localToWorld(shape, p.x, p.y));
        r.strokePolygon(rectWorld, { r: 0, g: 200, b: 255, a: 255 }, 2, true);

        // Ручки изменения размера
        const localHandles = getLocalResizeHandles(shape);
        for (const pos of Object.values(localHandles)) {
            const worldPos = localToWorld(shape, pos.x, pos.y);
            const rect = [
                { x: worldPos.x - handleSize / 2, y: worldPos.y - handleSize / 2 },
                { x: worldPos.x + handleSize / 2, y: worldPos.y - handleSize / 2 },
                { x: worldPos.x + handleSize / 2, y: worldPos.y + handleSize / 2 },
                { x: worldPos.x - handleSize / 2, y: worldPos.y + handleSize / 2 },
            ];
            r.fillPolygon(rect, { r: 255, g: 255, b: 255, a: 255 });
            r.strokePolygon(rect, { r: 0, g: 0, b: 0, a: 255 }, 1, true);
        }

        // Ручка поворота
        const cx = (localBounds.minX + localBounds.maxX) / 2;
        const rotLocal = { x: cx, y: localBounds.minY - rotRadius - 5 };
        const rotWorld = localToWorld(shape, rotLocal.x, rotLocal.y);
        const anchorWorld = localToWorld(shape, cx, localBounds.minY);
        r.drawLine(
            anchorWorld.x,
            anchorWorld.y,
            rotWorld.x,
            rotWorld.y,
            { r: 0, g: 200, b: 255, a: 255 },
            2,
        );
        r.fillCircle(rotWorld.x, rotWorld.y, rotRadius, { r: 255, g: 255, b: 255, a: 255 });
        r.strokeCircle(rotWorld.x, rotWorld.y, rotRadius, { r: 0, g: 0, b: 0, a: 255 }, 1);
        r.fillCircle(rotWorld.x, rotWorld.y, 5, { r: 0, g: 200, b: 255, a: 255 });

        // Контрольные точки (жёлтые)
        if ('getControlPoints' in shape) {
            const cps = (shape as any).getControlPoints();
            if (cps && cps.length) {
                for (let i = 0; i < cps.length; i++) {
                    const [sx, sy] = shape.transformPointToDevice(cps[i].x, cps[i].y);
                    const isHovered = editorRef.current.selectedPointIndex === i;
                    const radius = isHovered ? 8 : 6;
                    r.fillCircle(sx, sy, radius, { r: 0, g: 0, b: 0, a: 0 });
                    r.strokeCircle(sx, sy, radius, { r: 0, g: 0, b: 0, a: 255 }, 1);
                }
            }
        }
    };

    const render = () => {
        const r = rendererRef.current;
        if (!r) return;
        r.beginFrame(true);
        for (const shape of editorRef.current.shapes) shape.drawRaster(r);
        if (editorRef.current.selected) drawSelection(r, editorRef.current.selected);
        r.commit();
    };

    const notifyChanges = () => {
        if (onShapesChange) onShapesChange([...editorRef.current.shapes]);
        if (onSelectedChange) onSelectedChange(editorRef.current.selected);
    };

    // ========== API для внешних компонентов ==========
    const getShapes = () => editorRef.current.shapes;
    const getSelected = () => editorRef.current.selected;

    const addShape = (shape: Shape) => {
        editorRef.current.shapes.push(shape);
        editorRef.current.selected = shape;
        editorRef.current.mode = 'idle';
        notifyChanges();
        render();
    };

    const deleteSelected = () => {
        if (editorRef.current.selected) {
            editorRef.current.shapes = editorRef.current.shapes.filter(
                (s) => s !== editorRef.current.selected,
            );
            editorRef.current.selected = null;
            editorRef.current.mode = 'idle';
            notifyChanges();
            render();
        }
    };

    const moveLayerUp = () => {
        const { selected, shapes } = editorRef.current;
        if (!selected) return;
        const idx = shapes.indexOf(selected);
        if (idx < shapes.length - 1) {
            [shapes[idx], shapes[idx + 1]] = [shapes[idx + 1], shapes[idx]];
            notifyChanges();
            render();
        }
    };

    const moveLayerDown = () => {
        const { selected, shapes } = editorRef.current;
        if (!selected) return;
        const idx = shapes.indexOf(selected);
        if (idx > 0) {
            [shapes[idx], shapes[idx - 1]] = [shapes[idx - 1], shapes[idx]];
            notifyChanges();
            render();
        }
    };

    // ========== Работа с точками для PathBezier ==========
    const pointToSegmentDistance = (p: Point, a: Point, b: Point): number => {
        const dx = b.x - a.x,
            dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t * dx,
            projY = a.y + t * dy;
        return Math.hypot(p.x - projX, p.y - projY);
    };

    const addControlPoint = (shape: Shape, x: number, y: number) => {
        if (!(shape instanceof PathBezier)) {
            alert('Добавление точек доступно только для PathBezier');
            return;
        }
        const cps = shape.getControlPoints();
        if (cps.length < 2) {
            alert('Нужно минимум 2 точки');
            return;
        }
        let minDist = Infinity,
            insertIndex = cps.length;
        for (let i = 0; i < cps.length - 1; i++) {
            const p1 = cps[i],
                p2 = cps[i + 1];
            const [sx1, sy1] = shape.transformPointToDevice(p1.x, p1.y);
            const [sx2, sy2] = shape.transformPointToDevice(p2.x, p2.y);
            const dist = pointToSegmentDistance({ x, y }, { x: sx1, y: sy1 }, { x: sx2, y: sy2 });
            if (dist < minDist) {
                minDist = dist;
                insertIndex = i + 1;
            }
        }
        // Передаём мировые координаты (x, y) – PathBezier сам переведёт в локальные
        shape.addPointLocal({ x, y }, insertIndex);
        render();
        notifyChanges();
    };

    const removeNearestControlPoint = (shape: Shape, x: number, y: number) => {
        if (!(shape instanceof PathBezier)) {
            alert('Удаление точек доступно только для PathBezier');
            return;
        }
        const cps = shape.getControlPoints();
        if (cps.length <= 2) {
            alert('Нельзя удалить точку: должно остаться минимум 2 точки');
            return;
        }
        let minDist = Infinity,
            removeIndex = -1;
        for (let i = 0; i < cps.length; i++) {
            const cp = cps[i];
            const [sx, sy] = shape.transformPointToDevice(cp.x, cp.y);
            const dist = Math.hypot(x - sx, y - sy);
            if (dist < minDist) {
                minDist = dist;
                removeIndex = i;
            }
        }
        if (removeIndex !== -1 && minDist < 50) {
            shape.removePoint(removeIndex);
            render();
            notifyChanges();
        }
    };

    const onContextMenu = (e: PointerEvent) => {
        e.preventDefault();
        const { x, y } = getScenePoint(e);
        const editor = editorRef.current;
        if (editor.selected && editor.selected instanceof PathBezier) {
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.position = 'fixed';
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.innerHTML = `
                <div class="context-menu-item" data-action="add">➕ Добавить точку</div>
                <div class="context-menu-item" data-action="remove">❌ Удалить ближайшую точку</div>
            `;
            menu.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const action = target.dataset.action;
                if (action === 'add') addControlPoint(editor.selected!, x, y);
                else if (action === 'remove') removeNearestControlPoint(editor.selected!, x, y);
                menu.remove();
            });
            document.body.appendChild(menu);
            const closeMenu = () => menu.remove();
            setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
        }
    };

    // ========== Обработчики указателя ==========
    const onPointerDown = (e: PointerEvent) => {
        const { x, y } = getScenePoint(e);
        const editor = editorRef.current;

        // Режим поворота по Ctrl или R
        if (editor.selected && (e.ctrlKey || editor.rotateModeActive)) {
            const center = editor.selected.getCenter();
            editor.mode = 'rotate';
            editor.dragStart = { x, y };
            editor.startTransform = { ...editor.selected.transform };
            editor.startAngle = Math.atan2(y - center.y, x - center.x);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            render();
            return;
        }

        // Редактирование контрольной точки
        if (editor.selected) {
            const cpIdx = getControlPointAt(editor.selected, x, y);
            if (cpIdx !== null) {
                editor.mode = 'edit-point';
                editor.selectedPointIndex = cpIdx;
                editor.dragStart = { x, y };
                editor.startTransform = { ...editor.selected.transform };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                render();
                return;
            }
        }

        // Ручка поворота
        if (editor.selected && isRotateHandleAtPoint(editor.selected, x, y)) {
            const center = editor.selected.getCenter();
            editor.mode = 'rotate';
            editor.dragStart = { x, y };
            editor.startTransform = { ...editor.selected.transform };
            editor.startAngle = Math.atan2(y - center.y, x - center.x);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            render();
            return;
        }

        // Изменение размера
        if (editor.selected) {
            const handle = getResizeHandleAtPoint(editor.selected, x, y);
            if (handle) {
                editor.mode = 'resize';
                editor.selectedHandle = handle;
                editor.dragStart = { x, y };
                const localBounds = getLocalBoundsNoPadding(editor.selected);
                if (localBounds) editor.startLocalBounds = { ...localBounds };
                editor.startScaleX = editor.selected.transform.scaleX;
                editor.startScaleY = editor.selected.transform.scaleY;
                editor.startTransform = { ...editor.selected.transform };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                render();
                return;
            }
        }

        // Выбор или перемещение
        const shape = hitTestAll(x, y);
        if (shape) {
            if (editor.selected !== shape) {
                editor.selected = shape;
                notifyChanges();
            }
            editor.mode = 'move';
            editor.dragStart = { x, y };
            editor.startTransform = { ...shape.transform };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } else {
            editor.selected = null;
            editor.mode = 'idle';
            notifyChanges();
        }
        render();
    };

    const onPointerMove = (e: PointerEvent) => {
        const editor = editorRef.current;
        const { x, y } = getScenePoint(e);

        if (!editor.dragStart) {
            updateCursor(x, y);
            return;
        }

        const dx = x - editor.dragStart.x;
        const dy = y - editor.dragStart.y;

        if (editor.mode === 'move' && editor.selected && editor.startTransform) {
            editor.selected.transform = {
                ...editor.startTransform,
                x: editor.startTransform.x + dx,
                y: editor.startTransform.y + dy,
            };
            render();
            notifyChanges();
        } else if (
            editor.mode === 'resize' &&
            editor.selected &&
            editor.startLocalBounds &&
            editor.startTransform
        ) {
            const b = editor.startLocalBounds;
            if (!b) return;
            const localMouse = worldToLocal(editor.selected, x, y);
            if (!localMouse) return;
            const startLocalMouse = worldToLocal(
                editor.selected,
                editor.dragStart.x,
                editor.dragStart.y,
            );
            if (!startLocalMouse) return;
            const localDx = localMouse.x - startLocalMouse.x;
            const localDy = localMouse.y - startLocalMouse.y;
            let newScaleX = editor.startScaleX;
            let newScaleY = editor.startScaleY;
            const handle = editor.selectedHandle!;
            const origWidth = b.maxX - b.minX;
            const origHeight = b.maxY - b.minY;
            if (handle.includes('e')) newScaleX = editor.startScaleX + localDx / origWidth;
            if (handle.includes('w')) newScaleX = editor.startScaleX - localDx / origWidth;
            if (handle.includes('s')) newScaleY = editor.startScaleY + localDy / origHeight;
            if (handle.includes('n')) newScaleY = editor.startScaleY - localDy / origHeight;
            const minScale = 0.1;
            if (newScaleX < minScale) newScaleX = minScale;
            if (newScaleY < minScale) newScaleY = minScale;
            editor.selected.transform.scaleX = newScaleX;
            editor.selected.transform.scaleY = newScaleY;
            const localCenterX = (b.minX + b.maxX) / 2;
            const localCenterY = (b.minY + b.maxY) / 2;
            const oldCenterWorld = localToWorld(editor.selected, localCenterX, localCenterY);
            const oldX = editor.startTransform.x;
            const oldY = editor.startTransform.y;
            const oldRot = editor.startTransform.rotation;
            editor.selected.transform.x = oldX;
            editor.selected.transform.y = oldY;
            editor.selected.transform.rotation = oldRot;
            const newCenterWorld = localToWorld(editor.selected, localCenterX, localCenterY);
            const offsetX = oldCenterWorld.x - newCenterWorld.x;
            const offsetY = oldCenterWorld.y - newCenterWorld.y;
            editor.selected.transform.x = oldX + offsetX;
            editor.selected.transform.y = oldY + offsetY;
            render();
            notifyChanges();
        } else if (
            editor.mode === 'rotate' &&
            editor.selected &&
            editor.startTransform &&
            editor.startAngle !== null
        ) {
            const center = editor.selected.getCenter();
            const currAngle = Math.atan2(y - center.y, x - center.x);
            let newRotation = editor.startTransform.rotation + (currAngle - editor.startAngle);
            newRotation = ((newRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            editor.selected.transform = { ...editor.startTransform, rotation: newRotation };
            render();
            notifyChanges();
        } else if (
            editor.mode === 'edit-point' &&
            editor.selected &&
            editor.selectedPointIndex !== null &&
            'setControlPoint' in editor.selected
        ) {
            const shape = editor.selected;
            const idx = editor.selectedPointIndex;

            // PathBezier ожидает мировые координаты, остальные — локальные
            if (shape instanceof PathBezier) {
                (shape as any).setControlPoint(idx, { x, y });
            } else {
                const local = shape.transformPointToLocal(x, y);
                if (local) {
                    (shape as any).setControlPoint(idx, { x: local[0], y: local[1] });
                }
            }
            render();
            notifyChanges();
        }
    };

    const onPointerUp = (e: PointerEvent) => {
        const editor = editorRef.current;
        editor.dragStart = null;
        editor.startTransform = null;
        editor.startLocalBounds = null;
        editor.startAngle = null;
        editor.selectedHandle = null;
        editor.selectedPointIndex = null;
        if (editor.mode !== 'idle') editor.mode = 'idle';
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        render();
    };

    // ========== Клавиатура ==========
    const onKeyDown = (e: KeyboardEvent) => {
        const editor = editorRef.current;
        if (e.key === 'Delete' && editor.selected) {
            editor.shapes = editor.shapes.filter((s) => s !== editor.selected);
            editor.selected = null;
            notifyChanges();
            render();
            e.preventDefault();
        }
        if (e.key === 'r' || e.key === 'R') {
            editor.rotateModeActive = true;
            e.preventDefault();
        }
        if (editor.selected) {
            const idx = editor.shapes.indexOf(editor.selected);
            if (e.key === ']' && idx < editor.shapes.length - 1) {
                [editor.shapes[idx], editor.shapes[idx + 1]] = [
                    editor.shapes[idx + 1],
                    editor.shapes[idx],
                ];
                notifyChanges();
                render();
                e.preventDefault();
            }
            if (e.key === '[' && idx > 0) {
                [editor.shapes[idx], editor.shapes[idx - 1]] = [
                    editor.shapes[idx - 1],
                    editor.shapes[idx],
                ];
                notifyChanges();
                render();
                e.preventDefault();
            }
        }
    };

    const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'r' || e.key === 'R') editorRef.current.rotateModeActive = false;
    };

    // ========== Добавление/удаление точек по клику (режимы из UI) ==========
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleCanvasClick = (e: MouseEvent) => {
            const canvasEl = canvasRef.current;
            if (!canvasEl) return;
            const rect = canvasEl.getBoundingClientRect();
            const scaleX = canvasEl.width / rect.width,
                scaleY = canvasEl.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX,
                y = (e.clientY - rect.top) * scaleY;
            const editor = editorRef.current;
            if (addPointMode && editor.selected && editor.selected instanceof PathBezier) {
                if (editor.selected.hitTest(x, y)) addControlPoint(editor.selected, x, y);
                else alert('Кликните на кривую PathBezier');
                onAddPointModeChange?.(false);
                canvasEl.style.cursor = 'default';
            } else if (
                removePointMode &&
                editor.selected &&
                editor.selected instanceof PathBezier
            ) {
                removeNearestControlPoint(editor.selected, x, y);
                onRemovePointModeChange?.(false);
                canvasEl.style.cursor = 'default';
            }
        };
        canvas.addEventListener('click', handleCanvasClick);
        return () => canvas.removeEventListener('click', handleCanvasClick);
    }, [addPointMode, removePointMode, onAddPointModeChange, onRemovePointModeChange]);

    // ========== Инициализация ==========
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const renderer = new RasterRenderer(canvas);
        renderer.setLineAlgorithm(lineAlg);

        rendererRef.current = renderer;

        editorRef.current.shapes = [
            new Rect(200, 150, {
                transform: { x: 300, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
                fillStyle: '#ff4444',
                fillOpacity: 1,
                strokeStyle: '#000000',
                strokeWidth: 2,
            }),
            new Oval(80, 60, {
                transform: { x: 550, y: 300, rotation: 0.3, scaleX: 1, scaleY: 1 },
                fillStyle: '#4444ff',
                fillOpacity: 0.6,
                strokeStyle: '#000000',
                strokeWidth: 2,
            }),
            new Triangle(
                { x: 100, y: 450 },
                { x: 200, y: 550 },
                { x: 50, y: 550 },
                { fillStyle: '#6fff00', fillOpacity: 0.7, strokeStyle: '#000000', strokeWidth: 3 },
            ),
            new QuadraticBezier(
                { x: 400, y: 450 },
                { x: 500, y: 350 },
                { x: 600, y: 450 },
                { strokeStyle: '#ff6600', strokeWidth: 4, strokeOpacity: 1 },
            ),
            new CubicBezier(
                { x: 650, y: 450 },
                { x: 700, y: 350 },
                { x: 780, y: 550 },
                { x: 850, y: 450 },
                { strokeStyle: '#ff00ff', strokeWidth: 4, strokeOpacity: 1 },
            ),
            new PathBezier(
                [
                    { x: 100, y: 200 },
                    { x: 200, y: 150 },
                    { x: 250, y: 250 },
                    { x: 350, y: 180 },
                    { x: 400, y: 220 },
                ],
                { strokeStyle: '#ff0000', strokeWidth: 3, mode: 'catmull', closed: false },
            ),
        ];

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
        canvas.addEventListener('contextmenu', onContextMenu);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        let raf = 0;
        const frame = () => {
            render();
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointerleave', onPointerUp);
            canvas.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            renderer.dispose();
        };
    }, []);

    useEffect(() => {
        rendererRef.current?.setLineAlgorithm(lineAlg);
    }, [lineAlg]);

    useEffect(() => {
        if (canvasRef.current) {
            (canvasRef.current as any).__editorApi = {
                getShapes,
                getSelected,
                addShape,
                deleteSelected,
                moveLayerUp,
                moveLayerDown,
            };
        }
    });

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    );
};
