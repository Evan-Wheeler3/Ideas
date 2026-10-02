import type { JointName, Pose, PosePreset } from './types'

// Joint rotations in degrees. The figure faces +Z.
// Negative X swings an arm or leg forward; positive X bends a knee back.
// Positive Z lifts the left arm outward; negative Z lifts the right arm outward.
export const POSES: Record<PosePreset, Pose> = {
  stand: {
    preset: 'stand',
    hipsY: 0,
    joints: { armL: [0, 0, 8], armR: [0, 0, -8], forearmL: [-8, 0, 0], forearmR: [-8, 0, 0] }
  },
  sit: {
    preset: 'sit',
    hipsY: -0.42,
    joints: {
      torso: [-4, 0, 0],
      legL: [-88, 0, 4], legR: [-88, 0, -4],
      shinL: [88, 0, 0], shinR: [88, 0, 0],
      armL: [-28, 0, 10], armR: [-28, 0, -10],
      forearmL: [-45, 0, 0], forearmR: [-45, 0, 0]
    }
  },
  walk: {
    preset: 'walk',
    hipsY: -0.02,
    joints: {
      legL: [-24, 0, 0], shinL: [8, 0, 0],
      legR: [18, 0, 0], shinR: [28, 0, 0],
      armL: [20, 0, 7], armR: [-22, 0, -7],
      forearmL: [-12, 0, 0], forearmR: [-28, 0, 0]
    }
  },
  run: {
    preset: 'run',
    hipsY: -0.07,
    joints: {
      torso: [14, 0, 0], head: [-10, 0, 0],
      legL: [-60, 0, 0], shinL: [65, 0, 0],
      legR: [28, 0, 0], shinR: [95, 0, 0],
      armL: [45, 0, 8], armR: [-55, 0, -8],
      forearmL: [-85, 0, 0], forearmR: [-95, 0, 0]
    }
  },
  point: {
    preset: 'point',
    hipsY: 0,
    joints: {
      head: [0, -12, 0],
      armL: [0, 0, 8], forearmL: [-8, 0, 0],
      armR: [-84, -8, -6], forearmR: [-4, 0, 0]
    }
  }
}

export const POSE_LABELS: Record<PosePreset, string> = {
  stand: 'Stand',
  sit: 'Sit',
  walk: 'Walk',
  run: 'Run',
  point: 'Point'
}

export const JOINT_LABELS: Record<JointName, string> = {
  head: 'Head',
  torso: 'Torso',
  armL: 'Left upper arm',
  armR: 'Right upper arm',
  forearmL: 'Left forearm',
  forearmR: 'Right forearm',
  legL: 'Left thigh',
  legR: 'Right thigh',
  shinL: 'Left shin',
  shinR: 'Right shin'
}

export const clonePose = (preset: PosePreset): Pose => structuredClone(POSES[preset])
