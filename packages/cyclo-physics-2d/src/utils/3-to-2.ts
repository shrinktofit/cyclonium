import { clamp } from '@cyclonium/core/math/number';
import type { Quat } from 'cc';

export function getZRotation(quat: Quat) {
  const { z, w } = quat;
  const halfTheta = Math.acos(clamp(w, -1, 1));
  if (halfTheta === 0) {
    return 0;
  }
  const sinSign = Math.sign(halfTheta);
  const axisSign = sinSign * Math.sign(z);
  return axisSign * halfTheta * 2;
}
