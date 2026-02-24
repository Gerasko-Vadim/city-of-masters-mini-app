export interface TaskOption {
  id: string;
  label: string;
  priceRange?: string;
  subTasks?: TaskOption[];
}

export interface Category {
  id: string;
  label: string;
  icon?: string;
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
    questions: [
      {
        id: 'help_type',
        text: 'Чем помочь?',
        options: [
          {
            id: 'repair',
            label: 'Починить',
            subTasks: [
              { id: 'socket_regular', label: 'Обычную розетку', priceRange: '200-390' },
              { id: 'switch_regular', label: 'Обычный выключатель', priceRange: '200-390' },
              { id: 'spotlight', label: 'Точечный светильник', priceRange: '500-600' },
              { id: 'socket_power', label: 'Силовую розетку', priceRange: '600-1000' },
              { id: 'switch_sensor', label: 'Сенсорный выключатель', priceRange: '800-1300' },
              { id: 'wiring', label: 'Проводку' },
              { id: 'other_repair', label: 'Другое (указать)' }
            ]
          },
          {
            id: 'install',
            label: 'Установить',
            subTasks: [
              { id: 'chandelier', label: 'Люстру (стандарт)', priceRange: '500-800' },
              { id: 'sconce', label: 'Бра', priceRange: '350-500' },
              { id: 'led_strip', label: 'Лед светильники', priceRange: '300-500' },
              { id: 'spotlights_install', label: 'Точечные светильники', priceRange: '350' },
              { id: 'motion_sensor', label: 'Датчики движения и света', priceRange: '400-800' },
              { id: 'sockets_install', label: 'Розетки', priceRange: '290-350' },
              { id: 'switches_install', label: 'Выключатели', priceRange: '290-350' },
              { id: 'thermostat', label: 'Терморегуляторы', priceRange: '450-600' },
              { id: 'other_install', label: 'Другое (указать)' }
            ]
          },
          { id: 'check_wiring', label: 'Проверить проводку', priceRange: '700-1000' },
          { id: 'replace_lamp', label: 'Заменить лампу', priceRange: '200' },
          { id: 'full_wiring', label: 'Провести или частично заменить проводку', priceRange: 'от 2500' },
          { id: 'circuit_breaker', label: 'Заменить автомат', priceRange: '1 фаза 300, 2 фазы 500' },
          { id: 'other_general', label: 'Другое (заполнить)' }
        ]
      }
    ]
  },
  {
    id: 'plumber',
    label: 'Сантехник',
    questions: [
      {
        id: 'help_type',
        text: 'Чем вам помочь?',
        options: [
          { id: 'clog', label: 'Засоры (кухня/унитаз)', priceRange: '1000-1500' },
          { id: 'leak', label: 'Протечка смесителя или гибкой подводки', priceRange: '400-700' },
          { id: 'toilet_repair', label: 'Поломка арматуры унитаза', priceRange: '500-900' },
          { id: 'faucet_replace', label: 'Замена смесителя', priceRange: '600-1000' },
          { id: 'appliance_connect', label: 'Подключение стиральной/посудомоечной машины', priceRange: '800-1200' },
          { id: 'filter_install', label: 'Установка фильтров для воды', priceRange: '500-800' },
          { id: 'other_plumbing', label: 'Другое (указать)' }
        ]
      }
    ]
  }
];

export const PROPERTY_TYPES = [
  'Квартира в жилом доме',
  'Квартира в новостройке',
  'Частный индивидуальный дом',
  'Общедомовое помещение',
  'Промышленное здание',
  'Другое (выбрать)'
];
