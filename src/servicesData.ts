export interface TaskOption {
  id: string;
  label: string;
  icon?: string;
  priceRange?: string;
  subTasks?: TaskOption[];
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  questions: Question[];
}

export interface Question {
  id: string;
  text: string;
  options: TaskOption[];
}

export const SERVICES_DATA: Category[] = [
  {
    id: 'electrician',
    label: 'Электрик',
    icon: '⚡',
    description: 'Розетки, проводка, светильники',
    questions: [
      {
        id: 'help_type',
        text: 'Что нужно сделать?',
        options: [
          {
            id: 'repair',
            label: 'Починить / заменить',
            icon: '🔧',
            subTasks: [
              { id: 'socket_regular',   label: 'Розетку обычную',         icon: '🔌', priceRange: '250–400 сом' },
              { id: 'switch_regular',   label: 'Выключатель обычный',     icon: '💡', priceRange: '290–400 сом' },
              { id: 'switch_sensor',    label: 'Выключатель сенсорный',   icon: '✨', priceRange: '500–900 сом' },
              { id: 'socket_power',     label: 'Силовую розетку (плита/бойлер)', icon: '⚡', priceRange: '590–800 сом' },
              { id: 'spotlight',        label: 'Точечный светильник',     icon: '🔦', priceRange: '190–350 сом/шт' },
              { id: 'circuit_breaker',  label: 'Автомат в щитке',         icon: '🔒', priceRange: '250–500 сом' },
              { id: 'rcd',              label: 'УЗО / дифавтомат',        icon: '🛡️', priceRange: '590–1 200 сом' },
              { id: 'wiring_repair',    label: 'Проводку (участок)',      icon: '🔗', priceRange: 'от 90 сом/м' },
              { id: 'other_repair',     label: 'Другое (описать)',        icon: '📝' },
            ],
          },
          {
            id: 'install',
            label: 'Установить / смонтировать',
            icon: '🔩',
            subTasks: [
              { id: 'chandelier',         label: 'Люстру',                    icon: '🪔', priceRange: '400–2 200 сом' },
              { id: 'sconce',             label: 'Бра / настенный светильник', icon: '💡', priceRange: '450–600 сом' },
              { id: 'spotlights_install', label: 'Точечные светильники',      icon: '🔦', priceRange: '190–300 сом/шт' },
              { id: 'led_strip',          label: 'LED-ленту',                 icon: '🌈', priceRange: '300–800 сом' },
              { id: 'motion_sensor',      label: 'Датчик движения / света',   icon: '📡', priceRange: '400–800 сом' },
              { id: 'thermostat',         label: 'Терморегулятор',            icon: '🌡️', priceRange: '450–600 сом' },
              { id: 'sockets_install',    label: 'Розетки (новые)',           icon: '🔌', priceRange: '250–400 сом/шт' },
              { id: 'switches_install',   label: 'Выключатели (новые)',       icon: '💡', priceRange: '290–400 сом/шт' },
              { id: 'other_install',      label: 'Другое (описать)',          icon: '📝' },
            ],
          },
          { id: 'check_wiring',  label: 'Проверить / диагностировать проводку', icon: '🔍', priceRange: '300–600 сом' },
          { id: 'replace_lamp',  label: 'Заменить лампу',                       icon: '💡', priceRange: 'от 200 сом' },
          { id: 'full_wiring',   label: 'Полная замена / прокладка проводки',   icon: '🏗️', priceRange: 'от 3 000 сом/комната' },
          { id: 'other_general', label: 'Другое (описать)',                     icon: '📝' },
        ],
      },
    ],
  },
  {
    id: 'plumber',
    label: 'Сантехник',
    icon: '🔧',
    description: 'Краны, трубы, засоры, унитаз',
    questions: [
      {
        id: 'help_type',
        text: 'Что случилось?',
        options: [
          { id: 'clog',              label: 'Засор (кухня / туалет)',                    icon: '🚿', priceRange: '600–1 500 сом' },
          { id: 'clog_emergency',    label: 'Аварийная прочистка',                       icon: '🚨', priceRange: '790–2 000 сом' },
          { id: 'leak',              label: 'Течёт кран / гибкая подводка',             icon: '💧', priceRange: '400–800 сом' },
          { id: 'toilet_repair',     label: 'Не работает бачок унитаза',                icon: '🚽', priceRange: '600–1 500 сом' },
          { id: 'toilet_replace',    label: 'Заменить унитаз',                          icon: '🔄', priceRange: '1 500–2 500 сом' },
          { id: 'faucet_replace',    label: 'Заменить смеситель',                       icon: '🚰', priceRange: '800–1 200 сом' },
          { id: 'sink_install',      label: 'Установить раковину / мойку',              icon: '🪣', priceRange: '1 200–2 000 сом' },
          { id: 'appliance_connect', label: 'Подключить стиральную / посудомоечную машину', icon: '🫧', priceRange: '800–1 500 сом' },
          { id: 'boiler_install',    label: 'Установить водонагреватель (бойлер)',       icon: '🌡️', priceRange: '1 500–2 500 сом' },
          { id: 'filter_install',    label: 'Установить фильтр для воды',               icon: '💎', priceRange: '1 400–6 000 сом' },
          { id: 'water_meter',       label: 'Установить счётчик воды',                  icon: '📊', priceRange: '1 700–2 500 сом' },
          { id: 'pipe_replace',      label: 'Заменить трубы (участок)',                 icon: '🔩', priceRange: 'от 1 000 сом' },
          { id: 'other_plumbing',    label: 'Другое (описать)',                         icon: '📝' },
        ],
      },
    ],
  },
];

export const PROPERTY_TYPES = [
  'Квартира',
  'Новостройка',
  'Частный дом',
  'Офис',
  'Другое',
];
