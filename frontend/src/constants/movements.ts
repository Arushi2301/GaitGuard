export const MOVEMENTS = [
  {
    id: 'squat',
    name: 'Bodyweight Squat',
    view: 'Side view',
    icon: 'body',
    color: 'mint',
    available: true,
  },
  {
    id: 'walk',
    name: 'Walking',
    view: 'Side view',
    icon: 'walk',
    color: 'peach',
    available: false,
  },
  {
    id: 'drop-jump',
    name: 'Drop Jump',
    view: 'Front view',
    icon: 'arrow-down-circle',
    color: 'lavender',
    available: false,
  },
] as const;

export type Movement = (typeof MOVEMENTS)[number];

export const getMovement = (id?: string) => MOVEMENTS.find(m => m.id === id);