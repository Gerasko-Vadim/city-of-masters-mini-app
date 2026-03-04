import { useState, useEffect, useRef } from 'react';
import WebApp from '@twa-dev/sdk';
import axios from 'axios';
import { MapContainer, TileLayer, useMapEvents, Marker } from 'react-leaflet';
import { MapPin, ArrowLeft, ChevronRight, Phone, CheckCircle, MessageCircle, Search } from 'lucide-react';
import { SERVICES_DATA, PROPERTY_TYPES } from './servicesData';
import type { Category, TaskOption } from './servicesData';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Fix for default marker icon in leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BISHKEK_CENTER: [number, number] = [42.8746, 74.5698];

interface Order {
  id: number;
  status: 'NEW' | 'PAID' | 'IN_PROGRESS' | 'COMPLETED';
  address: string;
  lat: number;
  lng: number;
  paymentUrl?: string;
  assignedSpecialist?: {
    telegramId: string;
    name: string;
    username?: string;
    lat?: number;
    lng?: number;
  };
}

// Helper to move map view
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo(center, 15, {
      animate: true,
      duration: 1.5
    });
  }, [center, map]);
  return null;
}

// Helper for reverse geocoding
async function fetchAddress(lat: number, lng: number): Promise<string> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`,
      { headers: { 'User-Agent': 'CityOfMasters-MiniApp/1.0' } }
    );
    if (response.data && response.data.display_name) {
      const parts = response.data.display_name.split(', ');
      return parts.slice(0, 3).join(', ');
    }
  } catch (err) {
    console.error('Reverse geocoding failed', err);
  }
  return '';
}

function LocationMarker({ setPosition, setAddress, setIsBouncing }: { 
  setPosition: (pos: [number, number]) => void,
  setAddress: (addr: string) => void,
  setIsBouncing: (val: boolean) => void
}) {
  const map = useMapEvents({
    async moveend() {
      const center = map.getCenter();
      const newPos: [number, number] = [center.lat, center.lng];
      setPosition(newPos);
      
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 400);

      const addr = await fetchAddress(center.lat, center.lng);
      if (addr) setAddress(addr);
    }
  });

  return null;
}

function App() {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedHelpType, setSelectedHelpType] = useState<TaskOption | null>(null);
  const [selectedSubTask, setSelectedSubTask] = useState<TaskOption | null>(null);
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  
  const [position, setPosition] = useState<[number, number]>(BISHKEK_CENTER);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('+996 ');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [problemDescription, setProblemDescription] = useState('');

  const isPhoneValid = /^\+996 \d{3} \d{3} \d{3}$/.test(phone);
  const isAddressValid = address.trim().length >= 5;

  const phoneError = phoneTouched && !isPhoneValid ? 'Введите номер: +996 XXX XXX XXX' : '';
  const addressError = addressTouched && !isAddressValid ? 'Введите адрес (минимум 5 символов)' : '';

  const canProceedStep2 = isPhoneValid && isAddressValid;

  const formatPhoneInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const local = (digits.startsWith('996') ? digits.slice(3) : digits).slice(0, 9);
    if (local.length === 0) return '+996 ';
    if (local.length <= 3) return `+996 ${local}`;
    if (local.length <= 6) return `+996 ${local.slice(0, 3)} ${local.slice(3)}`;
    return `+996 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  };
  
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const SkeletonLoader = () => (
    <div className="skeleton-container" style={{ padding: '24px' }}>
      <div className="skeleton-header" style={{ height: '32px', width: '60%', background: '#eee', borderRadius: '8px', marginBottom: '24px' }}></div>
      <div className="skeleton-card" style={{ height: '200px', width: '100%', background: '#eee', borderRadius: '16px', marginBottom: '16px' }}></div>
      <div className="skeleton-list" style={{ display: 'grid', gap: '12px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '56px', width: '100%', background: '#eee', borderRadius: '12px' }}></div>
        ))}
      </div>
    </div>
  );

  useEffect(() => {
    const fetchActiveOrder = async () => {
      const tgUser = WebApp.initDataUnsafe?.user;
      if (!tgUser?.id) {
        setInitialLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${API_URL}/order/active/${tgUser.id}`);
        if (res.data) {
          setActiveOrder(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch active order', err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchActiveOrder();
  }, []);

  // Initial location detection
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          const addr = await fetchAddress(newPos[0], newPos[1]);
          if (addr) setAddress(addr);
        },
        (err) => {
          console.warn("Geolocation failed, using default center", err);
          fetchAddress(position[0], position[1]).then(addr => {
            if (addr) setAddress(addr);
          });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fetchAddress(position[0], position[1]).then(addr => {
        if (addr) setAddress(addr);
      });
    }
  }, []); // Only on mount

  useEffect(() => {
    if (!activeOrder) return;

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket');
    });

    socket.on('orderUpdate', (updatedOrder: Order) => {
      if (updatedOrder.id === activeOrder.id) {
        setActiveOrder((prev) => ({ ...prev, ...updatedOrder }));
      }
    });

    socket.on('specialistUpdate', (updatedSpec: any) => {
      if (activeOrder?.assignedSpecialist?.telegramId === String(updatedSpec.telegramId)) {
        setActiveOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignedSpecialist: {
              ...prev.assignedSpecialist!,
              lat: updatedSpec.lat,
              lng: updatedSpec.lng,
            },
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeOrder?.id, activeOrder?.assignedSpecialist?.telegramId]);

  useEffect(() => {
    try {
      if (typeof WebApp !== 'undefined') {
        WebApp.ready();
        WebApp.expand();
        if (WebApp.colorScheme) {
          document.documentElement.setAttribute('data-theme', WebApp.colorScheme);
        }
      }
    } catch (e) {
      console.warn('Telegram SDK not available');
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&viewbox=74.3,42.7,74.9,43.0&bounded=0&limit=1&accept-language=ru`,
        { headers: { 'User-Agent': 'CityOfMasters-MiniApp/1.0' } }
      );
      if (res.data && res.data[0]) {
        const { lat, lon, display_name } = res.data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        setAddress(display_name.split(', ').slice(0, 3).join(', '));
        
        // Trigger bounce for feedback
        setIsBouncing(true);
        setTimeout(() => setIsBouncing(false), 400);
      } else {
        WebApp.showAlert('Адрес не найден. Попробуйте уточнить поиск.');
      }
    } catch (err) {
      console.error('Search failed', err);
      WebApp.showAlert('Ошибка при поиске адреса.');
    }
  };

  const handleBack = () => {
    if (step === 1) {
      if (selectedSubTask) setSelectedSubTask(null);
      else if (selectedHelpType) setSelectedHelpType(null);
      else if (selectedCategory) setSelectedCategory(null);
    } else {
      setStep(step - 1);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    const user = WebApp.initDataUnsafe?.user;

    const priceRange = selectedSubTask?.priceRange ?? selectedHelpType?.priceRange ?? '';
    const taskLabel = [selectedHelpType?.label, selectedSubTask?.label].filter(Boolean).join(' — ');

    const descriptionLines = [
      taskLabel,
      `Объект: ${propertyType}`,
      priceRange ? `Стоимость: ${priceRange}` : '',
      problemDescription ? `Описание: ${problemDescription}` : '',
    ].filter(Boolean);

    const description = descriptionLines.join('\n');

    try {
      const res = await axios.post(`${API_URL}/payment/initiate`, {
        customerName: user?.first_name || 'Клиент',
        phone,
        address,
        description,
        totalAmount: 1,
        lat: position[0],
        lng: position[1],
        telegramId: user?.id ? String(user.id) : undefined,
        category: selectedCategory?.label,
      });
      WebApp.openLink(res.data.paymentUrl);
      setActiveOrder({
        id: res.data.orderId,
        status: 'NEW',
        address,
        lat: position[0],
        lng: position[1],
        paymentUrl: res.data.paymentUrl,
      });
    } catch (err) {
      console.error(err);
      WebApp.showAlert('Ошибка при создании заказа. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => {
    // ── Level 0: category selection ────────────────────────────────────
    if (!selectedCategory) {
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="title">Выберите мастера</div>
          <div className="subtitle">С какими работами вам нужна помощь сегодня?</div>
          <div className="grid-list">
            {SERVICES_DATA.map(cat => (
              <div
                key={cat.id}
                className="card-item"
                style={{ padding: '16px 20px', alignItems: 'center', gap: '16px' }}
                onClick={() => setSelectedCategory(cat)}
              >
                <div style={{ fontSize: '36px', lineHeight: 1, flexShrink: 0 }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-label" style={{ fontSize: '17px' }}>{cat.label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '2px' }}>{cat.description}</div>
                </div>
                <ChevronRight size={20} color="var(--secondary-text)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    const question = selectedCategory.questions?.[0];
    if (!question) return <div>Data Error: No questions for category</div>;

    // ── Level 1: help-type selection ───────────────────────────────────
    if (!selectedHelpType) {
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px' }}>{selectedCategory.icon}</span>
            <span style={{ fontSize: '14px', color: 'var(--secondary-text)', fontWeight: 500 }}>{selectedCategory.label}</span>
          </div>
          <div className="title" style={{ marginTop: '4px' }}>{question.text}</div>
          <div className="grid-list">
            {question.options.map(opt => (
              <div
                key={opt.id}
                className="card-item"
                style={{ padding: '14px 18px' }}
                onClick={() => {
                  if (opt.subTasks) setSelectedHelpType(opt);
                  else {
                    setSelectedHelpType(opt);
                    setStep(2);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  {opt.icon && <span style={{ fontSize: '22px', flexShrink: 0 }}>{opt.icon}</span>}
                  <span className="card-label">{opt.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {opt.priceRange && <span className="price-tag">{opt.priceRange}</span>}
                  {opt.subTasks
                    ? <ChevronRight size={20} color="var(--secondary-text)" />
                    : <ChevronRight size={20} color="var(--primary-color)" />
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── Level 2: sub-task selection ────────────────────────────────────
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px' }}>{selectedCategory.icon}</span>
          <span style={{ fontSize: '14px', color: 'var(--secondary-text)', fontWeight: 500 }}>{selectedCategory.label}</span>
          <ChevronRight size={14} color="var(--secondary-text)" />
          {selectedHelpType.icon && <span style={{ fontSize: '18px' }}>{selectedHelpType.icon}</span>}
          <span style={{ fontSize: '14px', color: 'var(--secondary-text)', fontWeight: 500 }}>{selectedHelpType.label}</span>
        </div>
        <div className="title" style={{ marginTop: '4px' }}>Уточните деталь</div>
        <div className="grid-list">
          {selectedHelpType.subTasks?.map(sub => (
            <div
              key={sub.id}
              className="card-item"
              style={{ padding: '14px 18px' }}
              onClick={() => {
                setSelectedSubTask(sub);
                setStep(2);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                {sub.icon && <span style={{ fontSize: '22px', flexShrink: 0 }}>{sub.icon}</span>}
                <span className="card-label">{sub.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {sub.priceRange && <span className="price-tag">{sub.priceRange}</span>}
                <ChevronRight size={20} color="var(--primary-color)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="title">Детали заказа</div>
      <div className="subtitle">Укажите адрес и контактные данные</div>

      {/* Map */}
      <div className="form-label">
        Местоположение <span className="field-required">*</span>
      </div>
      <div className="map-box">
        <MapContainer center={position} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <ChangeView center={position} />
          <TileLayer
            url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://2gis.kg/">2GIS</a>'
          />
          <LocationMarker setPosition={setPosition} setAddress={(addr) => { setAddress(addr); setAddressTouched(true); }} setIsBouncing={setIsBouncing} />
        </MapContainer>

        <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000 }}>
          <div style={{ position: 'relative' }}>
            <input
              className="premium-input"
              style={{ width: '100%', height: '44px', paddingRight: '44px', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-color)' }}
              placeholder="Введите адрес и нажмите 🔍 для поиска"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button
              onClick={handleSearch}
              style={{ position: 'absolute', right: '4px', top: '4px', bottom: '4px', width: '36px', background: 'var(--primary-color)', border: 'none', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        <div className={`yandex-marker ${isBouncing ? 'bouncing' : ''}`}>
          <MapPin size={40} color="#212121" fill="var(--primary-color)" strokeWidth={2} />
        </div>
      </div>

      {/* Address field */}
      <div className="form-group">
        <div className="form-label">
          Адрес <span className="field-required">*</span>
        </div>
        <input
          className={`premium-input ${addressError ? 'input-error' : addressTouched && isAddressValid ? 'input-success' : ''}`}
          value={address}
          onChange={(e) => { setAddress(e.target.value); setAddressTouched(true); }}
          onBlur={() => setAddressTouched(true)}
          placeholder="Улица, номер дома"
        />
        {addressError
          ? <div className="field-error-msg">⚠ {addressError}</div>
          : addressTouched && isAddressValid
            ? <div className="field-success-msg">✓ Адрес указан</div>
            : <div className="field-hint-msg">Уточните адрес или подвиньте карту</div>
        }
      </div>

      {/* Property type */}
      <div className="form-group">
        <div className="form-label">Тип объекта</div>
        <div className="grid-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          {PROPERTY_TYPES.map(type => (
            <div
              key={type}
              className={`card-item ${propertyType === type ? 'selected' : ''}`}
              onClick={() => setPropertyType(type)}
              style={{ padding: '12px' }}
            >
              <span className="card-label" style={{ fontSize: '13px' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phone field */}
      <div className="form-group">
        <div className="form-label">
          Номер телефона <span className="field-required">*</span>
        </div>
        <div style={{ position: 'relative' }}>
          <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: phoneError ? '#ef4444' : 'var(--secondary-text)', zIndex: 1 }} />
          <input
            className={`premium-input ${phoneError ? 'input-error' : phoneTouched && isPhoneValid ? 'input-success' : ''}`}
            style={{ paddingLeft: '45px' }}
            value={phone}
            inputMode="tel"
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
              setPhoneTouched(true);
            }}
            onBlur={() => setPhoneTouched(true)}
            placeholder="+996 555 123 456"
          />
        </div>
        {phoneError
          ? <div className="field-error-msg">⚠ {phoneError}</div>
          : phoneTouched && isPhoneValid
            ? <div className="field-success-msg">✓ Номер корректный</div>
            : <div className="field-hint-msg">Формат: +996 555 123 456</div>
        }
      </div>

      {/* Description */}
      <div className="form-group">
        <div className="form-label">Описание проблемы <span style={{ color: 'var(--secondary-text)', fontWeight: 400 }}>(необязательно)</span></div>
        <textarea
          className="premium-input"
          rows={3}
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Опишите детали, чтобы мастер мог лучше подготовиться..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="title">Оплата и подтверждение</div>
      <div className="subtitle">Оплатите комиссию через Finik — FIN, O!Money и другие банки</div>

      <div className="card-item" style={{ flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '24px' }}>
        <div style={{ fontSize: '52px' }}>💳</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-color)' }}>500 сом</div>
          <div style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '4px' }}>Фиксированная комиссия</div>
        </div>
      </div>

      <div className="alert-box" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          <strong>Как это работает:</strong><br/>
          1. Нажмите кнопку ниже<br/>
          2. Оплатите 500 сом через Finik (FIN, O!Money, и др.)<br/>
          3. После оплаты мы сразу начнём поиск мастера<br/>
          4. Уведомление придёт в Telegram
        </p>
      </div>
    </div>
  );

  const SEARCH_TIPS = [
    'Вы можете закрыть приложение — мы найдём мастера и пришлём уведомление в Telegram',
    'Мастера проходят проверку перед тем, как выйти на работу',
    'Среднее время ожидания — 10–20 минут. Спасибо за терпение 🙏',
    'Как только мастер примет заказ, вы сразу получите уведомление',
  ];
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTipIndex(i => (i + 1) % SEARCH_TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const renderRadarView = () => (
    <div className="step-container search-screen">

      {/* Steps */}
      <div className="search-steps">
        <div className="search-step done">
          <CheckCircle size={16} />
          <span>Заказ создан</span>
        </div>
        <div className="search-step-line done" />
        <div className="search-step done">
          <CheckCircle size={16} />
          <span>Оплата подтверждена</span>
        </div>
        <div className="search-step-line active" />
        <div className="search-step active">
          <div className="step-spinner" />
          <span>Ищем мастера</span>
        </div>
      </div>

      {/* Calm ripple animation */}
      <div className="ripple-container">
        <div className="ripple-ring r1" />
        <div className="ripple-ring r2" />
        <div className="ripple-ring r3" />
        <div className="ripple-core">
          <span style={{ fontSize: 36 }}>🔧</span>
        </div>
      </div>

      <div className="title" style={{ marginTop: 0, fontSize: 22 }}>Ищем мастера</div>
      <div className="subtitle" style={{ marginBottom: 8 }}>
        Мастера находятся в течение <strong>20 минут</strong>.
      </div>

      {/* Rotating tip */}
      <div className="search-tip-box">
        <span className="search-tip-text">{SEARCH_TIPS[tipIndex]}</span>
      </div>

      <button
        className="btn-main"
        onClick={() => WebApp.openTelegramLink('https://t.me/gorodmasterov312')}
        style={{ marginTop: 24 }}
      >
        <MessageCircle size={18} style={{ marginRight: 8 }} />
        Связаться с поддержкой
      </button>
    </div>
  );

  const renderTrackingView = () => {
    if (!activeOrder) return null;
    const spec = activeOrder.assignedSpecialist;
    const specialistPos: [number, number] | null = spec?.lat && spec?.lng ? [spec.lat, spec.lng] : null;
    const clientPos: [number, number] = [activeOrder.lat, activeOrder.lng];

    return (
      <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <div className="header" style={{ padding: '16px', background: 'white', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="title" style={{ fontSize: '18px', marginBottom: 0 }}>Заказ #{activeOrder.id}</div>
            <div style={{ padding: '4px 12px', background: 'rgba(76, 175, 80, 0.1)', color: 'var(--success-color)', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
              Мастер в пути
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={clientPos} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer 
              url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}" 
              attribution='&copy; <a href="https://2gis.kg/">2GIS</a>'
            />
            
            <Marker 
              position={clientPos}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #2196f3; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            />

            {specialistPos && (
              <Marker 
                position={specialistPos}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: var(--primary-color); width: 44px; height: 44px; border-radius: 50%; border: 3px solid white; box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center; font-size: 20px;">👷</div>`,
                  iconSize: [44, 44],
                  iconAnchor: [22, 22]
                })}
              />
            )}

            <ChangeView center={specialistPos || clientPos} />
          </MapContainer>

          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 1000 }}>
            <div style={{ background: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', boxShadow: '0 -10px 25px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', boxShadow: 'var(--shadow-md)' }}>
                  👷
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '20px', color: '#212121' }}>{spec?.name || 'Мастер'}</div>
                  <div style={{ fontSize: '14px', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} color="var(--success-color)" /> Проверенный специалист
                  </div>
                </div>
                <button 
                  className="btn-main" 
                  style={{ width: '50px', height: '50px', borderRadius: '50%', padding: 0 }}
                  onClick={() => spec?.username ? WebApp.openTelegramLink(`https://t.me/${spec.username}`) : WebApp.openTelegramLink(`https://t.me/city_of_masters_client_bot`)}
                >
                  <MessageCircle size={24} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', background: '#f8f8f8', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Адрес</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#212121', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{activeOrder.address}</div>
                </div>
                <div style={{ padding: '12px', background: '#f8f8f8', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Стоимость</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#212121' }}>Оплачено: 500 сом</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-main" 
                  style={{ flex: 2 }}
                  onClick={() => spec?.username ? WebApp.openTelegramLink(`https://t.me/${spec.username}`) : WebApp.openTelegramLink(`https://t.me/city_of_masters_client_bot`)}
                >
                  Написать мастеру
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, color: '#444' }}
                  onClick={() => WebApp.openTelegramLink('https://t.me/gorodmasterov312')}
                >
                  Поддержка
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (initialLoading) return <SkeletonLoader />;

  if (activeOrder) {
    if (activeOrder.status === 'NEW') return (
      <div className="step-container" style={{ textAlign: 'center', paddingTop: '60px', paddingBottom: '40px' }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>💳</div>
        <div className="title" style={{ fontSize: '22px', marginBottom: '12px' }}>Ожидаем оплату</div>
        <p className="subtitle" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '8px', color: 'var(--secondary-text)' }}>
          Завершите оплату в Finik — как только мы получим подтверждение,<br/>
          поиск мастера начнётся <strong>автоматически</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <span className="step-spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeOrder.paymentUrl && (
            <button
              className="btn-main"
              onClick={() => WebApp.openLink(activeOrder.paymentUrl!)}
              style={{ height: '54px', fontSize: '16px' }}
            >
              💳 Открыть страницу оплаты
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => WebApp.close()}
            style={{ height: '50px', fontSize: '15px', background: 'transparent', border: '1px solid var(--border-color)' }}
          >
            Закрыть
          </button>
        </div>
      </div>
    );
    if (activeOrder.status === 'PAID') return renderRadarView();
    if (activeOrder.status === 'IN_PROGRESS') return renderTrackingView();
    if (activeOrder.status === 'COMPLETED') {
      return (
        <div className="step-container" style={{ textAlign: 'center', paddingTop: '60px', paddingBottom: '40px' }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
            background: 'rgba(76, 175, 80, 0.1)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 24px' 
          }}>
            <CheckCircle size={60} color="var(--success-color)" />
          </div>
          <div className="title" style={{ fontSize: '24px', marginBottom: '12px' }}>Заказ выполнен!</div>
          <p className="subtitle" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '32px', color: 'var(--secondary-text)' }}>
            Благодарим вас за выбор нашего сервиса! <br/>
            Мы всегда готовы помочь вам снова. Желаем отличного дня! ✨
          </p>
          
          <button 
            className="btn-main" 
            onClick={() => {
              setActiveOrder(null);
              setStep(1);
              setSelectedCategory(null);
              setSelectedHelpType(null);
              setSelectedSubTask(null);
            }}
            style={{ height: '54px', fontSize: '16px' }}
          >
            Создать новый заказ
          </button>
        </div>
      );
    }
  }


  return (
    <div className="app-container">
      <div className="progress-bar">
        <div className="progress-val" style={{ width: `${(step / 3) * 100}%` }}></div>
      </div>

      {(step > 1 || selectedCategory) && (
        <div className="header">
          <button className="btn-back" onClick={handleBack}>
            <ArrowLeft size={24} />
          </button>
          <span style={{ fontWeight: 600 }}>Шаг {step} из 3</span>
        </div>
      )}

      <div className="step-container">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      <div className="footer-btn-container">
        {step === 1 && (selectedHelpType || (selectedCategory && !selectedCategory.questions?.[0].options.some(o => o.subTasks))) && (
          <button className="btn-main" onClick={() => setStep(2)}>Продолжить</button>
        )}
        {step === 2 && (
          <button
            className="btn-main"
            onClick={() => {
              setPhoneTouched(true);
              setAddressTouched(true);
              if (canProceedStep2) setStep(3);
            }}
            style={{ opacity: canProceedStep2 ? 1 : 0.55 }}
          >
            Перейти к оплате
          </button>
        )}
        {step === 3 && (
          <button className="btn-main" onClick={handlePayment} disabled={loading}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="btn-spinner" /> Создаём заказ...
                </span>
              : '💳 Перейти к оплате'
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
