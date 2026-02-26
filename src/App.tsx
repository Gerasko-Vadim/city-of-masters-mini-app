import { useState, useEffect, useRef } from 'react';
import WebApp from '@twa-dev/sdk';
import axios from 'axios';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from 'react-leaflet';
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
  assignedSpecialist?: {
    telegramId: string;
    name: string;
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
  const [problemDescription, setProblemDescription] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const fetchActiveOrder = async () => {
      const tgUser = WebApp.initDataUnsafe?.user;
      if (!tgUser?.id) return;

      try {
        const res = await axios.get(`${API_URL}/order/active/${tgUser.id}`);
        if (res.data) {
          setActiveOrder(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch active order', err);
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

  const createOrder = async () => {
    setLoading(true);
    const user = WebApp.initDataUnsafe?.user;
    
    const descriptionLines = [
      `Категория: ${selectedCategory?.label}`,
      `Тип помощи: ${selectedHelpType?.label}`,
      selectedSubTask ? `Задача: ${selectedSubTask.label}` : '',
      `Объект: ${propertyType}`,
      problemDescription ? `Описание: ${problemDescription}` : ''
    ].filter(Boolean);

    const description = descriptionLines.join('\n');

    try {
      await axios.post(`${API_URL}/order`, {
        customerName: user?.first_name || 'Клиент',
        phone,
        address,
        description,
        totalAmount: 500,
        lat: position[0],
        lng: position[1],
        telegramId: user?.id ? String(user.id) : undefined
      });
      setOrderCreated(true);
    } catch (err) {
      console.error(err);
      WebApp.showAlert('Ошибка при создании заказа. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => {
    if (!selectedCategory) {
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="title">Выберите мастера</div>
          <div className="subtitle">С какими работами вам нужна помощь сегодня?</div>
          <div className="grid-list">
            {SERVICES_DATA.map(cat => (
              <div key={cat.id} className="card-item" onClick={() => setSelectedCategory(cat)}>
                <span className="card-label">{cat.label}</span>
                <ChevronRight size={20} color="var(--secondary-text)" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    const question = selectedCategory.questions?.[0];
    if (!question) return <div>Data Error: No questions for category</div>;

    if (!selectedHelpType) {
      return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="title">{question.text}</div>
          <div className="subtitle">{selectedCategory.label}</div>
          <div className="grid-list">
            {question.options.map(opt => (
              <div key={opt.id} className="card-item" onClick={() => {
                if (opt.subTasks) setSelectedHelpType(opt);
                else {
                  setSelectedHelpType(opt);
                  setStep(2);
                }
              }}>
                <span className="card-label">{opt.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {opt.priceRange && <span className="price-tag">{opt.priceRange}</span>}
                  <ChevronRight size={20} color="var(--secondary-text)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="title">Уточните деталь</div>
        <div className="subtitle">{selectedHelpType.label}</div>
        <div className="grid-list">
          {selectedHelpType.subTasks?.map(sub => (
            <div key={sub.id} className="card-item" onClick={() => {
              setSelectedSubTask(sub);
              setStep(2);
            }}>
              <span className="card-label">{sub.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {sub.priceRange && <span className="price-tag">{sub.priceRange}</span>}
                <ChevronRight size={20} color="var(--secondary-text)" />
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
      
      <div className="form-label">Местоположение</div>
      <div className="map-box">
        <MapContainer center={position} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <ChangeView center={position} />
          <TileLayer 
            url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}" 
            attribution='&copy; <a href="https://2gis.kg/">2GIS</a>'
          />
          <LocationMarker setPosition={setPosition} setAddress={setAddress} setIsBouncing={setIsBouncing} />
        </MapContainer>
        
        {/* Floating Search */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input 
              className="premium-input" 
              style={{ width: '100%', height: '44px', paddingRight: '44px', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-color)' }}
              placeholder="Поиск адреса..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
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
      
      <div className="form-group">
        <div className="form-label">Адрес</div>
        <input 
          className="premium-input" 
          value={address} 
          onChange={(e) => setAddress(e.target.value)} 
          placeholder="Название улицы, номер дома" 
        />
      </div>

      <div className="form-group">
        <div className="form-label">Тип объекта</div>
        <div className="grid-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {PROPERTY_TYPES.map(type => (
            <div key={type} className={`card-item ${propertyType === type ? 'selected' : ''}`} onClick={() => setPropertyType(type)} style={{ padding: '12px' }}>
              <span className="card-label" style={{ fontSize: '13px' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <div className="form-label">Номер телефона</div>
        <div style={{ position: 'relative' }}>
          <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary-text)' }} />
          <input 
            className="premium-input" 
            style={{ paddingLeft: '45px' }}
            value={phone} 
            onChange={(e) => {
              let val = e.target.value;
              if (!val.startsWith('+996 ')) val = '+996 ';
              setPhone(val);
            }}
            placeholder="+996 555 123 456"
          />
        </div>
      </div>

      <div className="form-group">
        <div className="form-label">Описание проблемы (опционально)</div>
        <textarea 
          className="premium-input" 
          rows={3} 
          value={problemDescription} 
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Опишите подробности..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="title">Оплата и подтверждение</div>
      <div className="subtitle">Отсканируйте QR-код для оплаты комиссии</div>

      <div className="card-item" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '24px' }}>
        <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }}>
          {/* QR Code Placeholder */}
          <img 
            src="/mbusiness_qr.jpg" 
            alt="Payment QR" 
            style={{ width: '100%', height: 'auto', maxHeight: '300px', display: 'block', objectFit: 'contain', borderRadius: '8px' }}
            onError={(e) => {
              e.currentTarget.src = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=CityOfMastersPayment";
            }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-color)' }}>500 сом</div>
          <div style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '4px' }}>Фиксированная комиссия</div>
        </div>
      </div>

      <div className="alert-box" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          <strong>Инструкция:</strong><br/>
          1. Отсканируйте QR и оплатите 500 сом<br/>
          2. Сделайте скриншот чека<br/>
          3. Нажмите кнопку "Я оплатил" ниже<br/>
          4. Отправьте скриншот в чат нашего бота
        </p>
      </div>
    </div>
  );

  const renderRadarView = () => (
    <div className="step-container" style={{ textAlign: 'center', paddingTop: '40px' }}>
      <div className="title">Ищем мастера</div>
      <div className="subtitle">Оплата подтверждена. Мы подбираем лучшего специалиста рядом с вами.</div>
      
      <div className="radar-container">
        <div className="radar-circle"></div>
        <div className="radar-circle"></div>
        <div className="radar-circle"></div>
        <div className="radar-sweep"></div>
        <div className="pulse"></div>
      </div>

      <div className="alert-box" style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search size={20} color="var(--primary-color)" />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Среднее время поиска: 2-5 минут</span>
        </div>
      </div>

      <button className="btn-secondary" onClick={() => WebApp.openTelegramLink('https://t.me/city_of_masters_client_bot')} style={{ marginTop: '24px' }}>
        <MessageCircle size={18} style={{ marginRight: '8px' }} />
        Связаться с оператором
      </button>
    </div>
  );

  const renderTrackingView = () => {
    if (!activeOrder) return null;
    const spec = activeOrder.assignedSpecialist;
    const specialistPos: [number, number] | null = spec?.lat && spec?.lng ? [spec.lat, spec.lng] : null;
    const clientPos: [number, number] = [activeOrder.lat, activeOrder.lng];

    return (
      <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="header" style={{ padding: '16px' }}>
          <div className="title" style={{ fontSize: '18px', marginBottom: 0 }}>Мастер в пути</div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={clientPos} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer 
              url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}" 
              attribution='&copy; <a href="https://2gis.kg/">2GIS</a>'
            />
            
            {/* Client Marker */}
            <Marker 
              position={clientPos}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #2196f3; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Popup>Ваше местоположение</Popup>
            </Marker>

            {/* Specialist Marker */}
            {specialistPos && (
              <Marker 
                position={specialistPos}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: var(--primary-color); width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center; transform: rotate(-45deg);">
                           <div style="transform: rotate(45deg);">👷</div>
                         </div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                })}
              >
                <Popup>{spec?.name || 'Мастер'}</Popup>
              </Marker>
            )}

            <ChangeView center={specialistPos || clientPos} />
          </MapContainer>

          {/* Specialist Info Card */}
          <div style={{ position: 'absolute', bottom: '24px', left: '16px', right: '16px', zIndex: 1000 }}>
            <div className="card-item" style={{ background: 'var(--bg-color)', boxShadow: 'var(--shadow-lg)', padding: '16px', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    👷
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{spec?.name || 'Имя не указано'}</div>
                    <div style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>Ваш мастер</div>
                  </div>
                </div>
                <button className="btn-main" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => WebApp.openTelegramLink('https://t.me/city_of_masters_client_bot')}>
                  <MessageCircle size={18} />
                </button>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', width: '100%', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Статус заказа</div>
                  <div style={{ fontWeight: 600, color: 'var(--success-color)' }}>В процессе исполнения</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Адрес</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeOrder.address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (activeOrder) {
    if (activeOrder.status === 'PAID') return renderRadarView();
    if (activeOrder.status === 'IN_PROGRESS') return renderTrackingView();
    if (activeOrder.status === 'COMPLETED') {
      return (
        <div className="step-container" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <CheckCircle size={80} color="var(--success-color)" style={{ marginBottom: '24px' }} />
          <div className="title">Заказ завершен!</div>
          <p className="subtitle">Спасибо, что воспользовались нашими услугами.</p>
          <button className="btn-main" onClick={() => setActiveOrder(null)}>На главную</button>
        </div>
      );
    }
  }

  if (orderCreated) {
    return (
      <div className="step-container" style={{ textAlign: 'center', paddingTop: '40px', paddingBottom: '40px' }}>
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
        <div className="title" style={{ fontSize: '24px', marginBottom: '12px' }}>Заявка создана!</div>
        <p className="subtitle" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '32px', color: 'var(--secondary-text)' }}>
          Ваша заявка ожидает подтверждения оплаты. <br/>
          <strong>Отправьте скриншот оплаты</strong> в чат бота, и мы сразу начнем поиск мастера.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            className="btn-main" 
            onClick={() => WebApp.openTelegramLink('https://t.me/city_of_masters_client_bot')}
            style={{ 
              height: '54px', 
              fontSize: '16px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <MessageCircle size={22} />
            Перейти в чат бота
          </button>
          
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
          <button className="btn-main" onClick={() => setStep(3)} disabled={phone.length < 13}>Перейти к оплате</button>
        )}
        {step === 3 && (
          <button className="btn-main" onClick={createOrder} disabled={loading}>
            {loading ? 'Обработка...' : 'Я оплатил'}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
