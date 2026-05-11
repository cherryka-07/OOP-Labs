export type Mat3 = [
    number, number, number,
    number, number, number,
    number, number, number,
];

export interface Point2D { x: number; y: number;}

export const EPS = 1e-10;

export const mat3 = {
    identity(): Mat3 {
        return [
            1,0,0,
            0,1,0,
            0,0,1
        ];
    },

    multiply(a: Mat3, b: Mat3): Mat3 {

       const result: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let r = 0; r < 3; r++){
            for (let c = 0; c < 3; c++) {
                let sum = 0;

                for (let k = 0; k < 3; k++) {
                    sum += a[r * 3 + k] * b[k * 3 + c];
                }
                result[r * 3 + c] = sum;
            }
        }

        return result;
    },

        translate(tx: number, ty: number): Mat3 {
    return [
      1, 0, tx,
      0, 1, ty,
      0, 0, 1
    ];
  },

  scale(sx: number, sy: number): Mat3 {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1
    ];
  },

  rotate(rad: number): Mat3 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    return [
      c, -s, 0,
      s,  c, 0,
      0,  0, 1
    ];
  },

  fromTransform(
    tx: number, ty: number, 
    angleRad: number, 
    sx: number, sy: number
    ): Mat3 {
    const t = mat3.translate(tx, ty);
    const r = mat3.rotate(angleRad);
    const s = mat3.scale(sx, sy);

    const rs = mat3.multiply(r, s);
    return mat3.multiply(t, rs);
    },

  transformPoint(m: Mat3, x: number, y: number): Point2D {
    return {
      x: m[0] * x + m[1] * y + m[2],
      y: m[3] * x + m[4] * y + m[5],
    };
  },

  invert(m: Mat3): Mat3 | null {
    const a = m[0], b = m[1], tx = m[2];
    const c = m[3], d = m[4], ty = m[5];
    

    const det = a*d - b*c;

    if (Math.abs(det) < 1e-10) {
      return null;
    }

    const invDet = 1.0 / det;

    return [
        d * invDet,                    
        -b * invDet,
        (b * ty - d * tx) * invDet,
        -c * invDet,                   
        a * invDet,                    
            
        (c * tx - a * ty) * invDet,    
        0, 0, 1    
    ];
  
  }
}; 