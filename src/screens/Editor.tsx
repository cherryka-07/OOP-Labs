// src/screens/Editor.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CanvasScene } from '../raster/CanvasScene';
import { LineAlg } from '../raster/RasterRenderer';
import { Rect, Oval, PathBezier, Triangle, QuadraticBezier, CubicBezier } from '../shapes';

export default function Editor() {
    const navigate = useNavigate();
    const { id } = useParams();
    const canvasRef = useRef<HTMLDivElement>(null);
    const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');
    const [shapes, setShapes] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [addPointMode, setAddPointMode] = useState(false);
    const [removePointMode, setRemovePointMode] = useState(false);

    const getEditorApi = () => {
        const canvas = document.querySelector('#canvas-scene canvas') as any;
        return canvas?.__editorApi;
    };

    const addShape = (type: string) => {
        const api = getEditorApi();
        if (!api) return;

        const centerX = 400;
        const centerY = 300;
        let shape = null;

        switch (type) {
            case 'rectangle':
                shape = new Rect(120, 80, {
                    transform: { x: centerX, y: centerY, rotation: 0, scaleX: 1, scaleY: 1 },
                    fillStyle: '#ff6b6b',
                    fillOpacity: 0.7,
                    strokeStyle: '#000000',
                    strokeWidth: 2,
                });
                break;
            case 'circle':
                shape = new Oval(60, 60, {
                    transform: { x: centerX, y: centerY, rotation: 0, scaleX: 1, scaleY: 1 },
                    fillStyle: '#4ecdc4',
                    fillOpacity: 0.7,
                    strokeStyle: '#000000',
                    strokeWidth: 2,
                });
                break;
            case 'triangle':
                shape = new Triangle(
                    { x: centerX - 60, y: centerY + 40 },
                    { x: centerX + 60, y: centerY + 40 },
                    { x: centerX, y: centerY - 50 },
                    {
                        fillStyle: '#ffe66d',
                        fillOpacity: 0.7,
                        strokeStyle: '#000000',
                        strokeWidth: 2,
                    },
                );
                break;
            case 'quadratic':
                shape = new QuadraticBezier(
                    { x: centerX - 50, y: centerY + 30 },
                    { x: centerX, y: centerY - 40 },
                    { x: centerX + 50, y: centerY + 30 },
                    {
                        strokeStyle: '#ff6600',
                        strokeWidth: 3,
                        strokeOpacity: 1,
                    },
                );
                break;
            case 'cubic':
                shape = new CubicBezier(
                    { x: centerX - 60, y: centerY + 20 },
                    { x: centerX - 20, y: centerY - 50 },
                    { x: centerX + 20, y: centerY + 50 },
                    { x: centerX + 60, y: centerY - 20 },
                    {
                        strokeStyle: '#ff00ff',
                        strokeWidth: 3,
                        strokeOpacity: 1,
                    },
                );
                break;
            case 'path':
                shape = new PathBezier(
                    [
                        { x: centerX - 80, y: centerY },
                        { x: centerX - 40, y: centerY - 50 },
                        { x: centerX, y: centerY + 30 },
                        { x: centerX + 40, y: centerY - 20 },
                        { x: centerX + 80, y: centerY },
                    ],
                    {
                        strokeStyle: '#ff6b6b',
                        strokeWidth: 3,
                        mode: 'catmull',
                        closed: false,
                    },
                );
                break;
        }

        if (shape) {
            api.addShape(shape);
        }
    };

    const deleteSelected = () => {
        const api = getEditorApi();
        if (api) api.deleteSelected();
    };

    const moveLayerUp = () => {
        const api = getEditorApi();
        if (api) api.moveLayerUp();
    };

    const moveLayerDown = () => {
        const api = getEditorApi();
        if (api) api.moveLayerDown();
    };

    // Добавление точки в выбранную кривую
    const handleAddPoint = () => {
        const api = getEditorApi();
        const selectedShape = api?.getSelected();
        if (selectedShape && 'addPointLocal' in selectedShape) {
            setAddPointMode(true);
            setRemovePointMode(false);
            const canvas = document.querySelector('#canvas-scene canvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.style.cursor = 'crosshair';
            }
            alert('Кликните на кривую в том месте, куда хотите добавить точку');
        } else {
            alert('Добавление точек доступно только для PathBezier (произвольная кривая)');
        }
    };

    // Удаление точки из выбранной кривой
    const handleRemovePoint = () => {
        const api = getEditorApi();
        const selectedShape = api?.getSelected();
        if (selectedShape && 'removePoint' in selectedShape) {
            const cps = selectedShape.getControlPoints();
            if (cps.length <= 2) {
                alert('Нельзя удалить точку: должно остаться минимум 2 точки');
                return;
            }
            setRemovePointMode(true);
            setAddPointMode(false);
            const canvas = document.querySelector('#canvas-scene canvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.style.cursor = 'crosshair';
            }
            alert('Кликните на точку, которую хотите удалить');
        } else {
            alert('Удаление точек доступно только для PathBezier (произвольная кривая)');
        }
    };

    useEffect(() => {
        const updateState = () => {
            const api = getEditorApi();
            if (api) {
                setShapes(api.getShapes() || []);
                setSelected(api.getSelected());
            }
        };

        const interval = setInterval(updateState, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="editor fade">
            <header>
                <button onClick={() => navigate(-1)}>← Назад</button>
                <h1>Проект №{id}</h1>
                <button onClick={() => navigate('/')}>Сохранить</button>
            </header>

            <div className="editor-main">
                {/* Левая панель — создание объектов */}
                <div className="sidebar-left">
                    <button onClick={() => addShape('rectangle')} title="Прямоугольник">
                        □
                    </button>
                    <button onClick={() => addShape('circle')} title="Эллипс">
                        ⚪
                    </button>
                    <button onClick={() => addShape('triangle')} title="Треугольник">
                        ▲
                    </button>
                    <button onClick={() => addShape('quadratic')} title="Квадратичная кривая Безье">
                        ⌒
                    </button>
                    <button onClick={() => addShape('cubic')} title="Кубическая кривая Безье">
                        ∼
                    </button>
                    <button onClick={() => addShape('path')} title="Произвольная кривая">
                        〰️
                    </button>
                    <div className="sidebar-divider" />
                    <button onClick={deleteSelected} title="Удалить выбранное" disabled={!selected}>
                        🗑️
                    </button>
                </div>

                {/* Холст */}
                <div className="canvas">
                    <div className="canvas-inner" id="canvas-scene">
                        <CanvasScene
                            lineAlg={lineAlg}
                            projectId={id}
                            onShapesChange={setShapes}
                            onSelectedChange={setSelected}
                            addPointMode={addPointMode}
                            removePointMode={removePointMode}
                            onAddPointModeChange={setAddPointMode}
                            onRemovePointModeChange={setRemovePointMode}
                        />
                    </div>
                </div>

                {/* Правая панель — слои и свойства */}
                <div className="sidebar-right">
                    {/* Панель алгоритмов */}
                    <div className="alg-section">
                        <h3>Алгоритм отрисовки</h3>
                        <div className="alg-buttons">
                            <button
                                className={lineAlg === 'bresenham' ? 'active' : ''}
                                onClick={() => setLineAlg('bresenham')}
                            >
                                Брезенхем
                            </button>
                            <button
                                className={lineAlg === 'wu' ? 'active' : ''}
                                onClick={() => setLineAlg('wu')}
                            >
                                Ву
                            </button>
                        </div>
                    </div>

                    <div className="alg-divider" />

                    {/* Панель слоёв */}
                    <div className="layer-section">
                        <div className="layer-header">
                            <h3>Слои</h3>
                            <div className="layer-buttons">
                                <button onClick={moveLayerUp} disabled={!selected} title="Выше">
                                    ↑
                                </button>
                                <button onClick={moveLayerDown} disabled={!selected} title="Ниже">
                                    ↓
                                </button>
                            </div>
                        </div>

                        <div className="layer-list">
                            {shapes.length === 0 ? (
                                <p className="layer-empty">Нет объектов</p>
                            ) : (
                                [...shapes].reverse().map((shape, idx) => {
                                    const actualIdx = shapes.length - idx;
                                    const isSelected = selected?.id === shape.id;
                                    return (
                                        <div
                                            key={shape.id}
                                            className={`layer-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <span className="layer-index">#{actualIdx}</span>
                                            <span className="layer-name">
                                                {shape.type || shape.constructor.name}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="alg-divider" />

                    {/* Свойства */}
                    <div className="properties">
                        <h3>Свойства</h3>
                        {selected ? (
                            <>
                                <p>
                                    <strong>Тип:</strong>{' '}
                                    {selected.type || selected.constructor.name}
                                </p>
                                <p>
                                    <strong>Позиция:</strong> ({Math.round(selected.transform.x)},{' '}
                                    {Math.round(selected.transform.y)})
                                </p>
                                <p>
                                    <strong>Поворот:</strong>{' '}
                                    {Math.round((selected.transform.rotation * 180) / Math.PI)}°
                                </p>
                                {selected.width && (
                                    <p>
                                        <strong>Ширина:</strong> {Math.round(selected.width)}
                                    </p>
                                )}
                                {selected.height && (
                                    <p>
                                        <strong>Высота:</strong> {Math.round(selected.height)}
                                    </p>
                                )}
                                {selected.anchors && (
                                    <p>
                                        <strong>Точек:</strong> {selected.anchors.length}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="no-selected">Ничего не выбрано</p>
                        )}
                    </div>

                    <div className="alg-divider" />

                    {/* Панель редактирования точек */}
                    <div className="point-controls">
                        <h3>Редактирование точек</h3>
                        <div className="point-buttons">
                            <button
                                onClick={handleAddPoint}
                                disabled={!selected || !('addPointLocal' in selected)}
                                title="Добавить точку (клик на кривую)"
                            >
                                ➕ Добавить точку
                            </button>
                            <button
                                onClick={handleRemovePoint}
                                disabled={
                                    !selected ||
                                    !('removePoint' in selected) ||
                                    selected?.anchors?.length <= 2
                                }
                                title="Удалить точку (клик на точку)"
                            >
                                ➖ Удалить точку
                            </button>
                        </div>
                        <p className="point-hint">💡 Правая кнопка мыши на кривой - открыть меню</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
