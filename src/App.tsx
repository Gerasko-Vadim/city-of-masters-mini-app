import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import axios from 'axios';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { MapPin, ArrowLeft, ChevronRight, Phone, CreditCard, CheckCircle } from 'lucide-react';
import { SERVICES_DATA, PROPERTY_TYPES } from './servicesData';
import type { Category, TaskOption } from './servicesData';
import 'leaflet/dist/leaflet.css';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BISHKEK_CENTER: [number, number] = [42.8746, 74.5698];

// Helper to move map view
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function LocationMarker({ setPosition, setAddress }: { 
  setPosition: (pos: [number, number]) => void,
  setAddress: (addr: string) => void
}) {
  const map = useMapEvents({
    async dragend() {
      const center = map.getCenter();
      const newPos: [number, number] = [center.lat, center.lng];
      setPosition(newPos);
      
      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&accept-language=ru`);
        if (response.data && response.data.display_name) {
          // Clean up the address a bit (remove country/region if long)
          const parts = response.data.display_name.split(', ');
          const shortAddr = parts.slice(0, 3).join(', ');
          setAddress(shortAddr);
        }
      } catch (err) {
        console.error('Reverse geocoding failed', err);
      }
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
        clientId: user?.id
      });
      setOrderCreated(true);
    } catch (err) {
      console.error(err);
      WebApp.showAlert('Ошибка при создании заказа. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  if (orderCreated) {
    return (
      <div className="step-container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <CheckCircle size={80} color="var(--success-color)" style={{ marginBottom: '24px' }} />
        <div className="title">Заявка успешно создана!</div>
        <p className="subtitle">Мастера свяжутся с вами в ближайшее время.</p>
        <button className="btn-main" onClick={() => WebApp.close()}>Закрыть</button>
      </div>
    );
  }

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
          <LocationMarker setPosition={setPosition} setAddress={setAddress} />
        </MapContainer>
        
        {/* Floating Search */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <input 
            className="premium-input" 
            style={{ flex: 1, height: '44px', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-color)' }}
            placeholder="Поиск адреса..."
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const query = e.currentTarget.value;
                if (!query) return;
                try {
                  const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=74.3,42.7,74.9,43.0&bounded=1&limit=1&accept-language=ru`);
                  if (res.data && res.data[0]) {
                    const { lat, lon, display_name } = res.data[0];
                    const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
                    setPosition(newPos);
                    setAddress(display_name.split(', ').slice(0, 3).join(', '));
                  }
                } catch (err) {
                  console.error('Search failed', err);
                }
              }
            }}
          />
        </div>

        <div className="yandex-marker">
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
      <div className="subtitle">Выставление счета для вызова мастера</div>

      <div className="card-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginBottom: '24px', background: 'var(--primary-color)', color: '#fff' }}>
        <div className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Итого к оплате</div>
        <div style={{ fontSize: '32px', fontWeight: '800' }}>500 сом</div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
          Комиссия сервиса составляет 15% от стоимости работ, но не менее 500 сом. 
        </p>
      </div>

      <div className="form-label">Способ оплаты</div>
      <div className="card-item selected" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CreditCard size={24} />
          <span className="card-label">Mbusiness QR / Карта</span>
        </div>
        <CheckCircle size={20} color="var(--primary-color)" />
      </div>

      <div className="card-item" style={{ opacity: 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CreditCard size={24} />
          <span className="card-label">Электронный кошелек</span>
        </div>
      </div>
    </div>
  );

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
            {loading ? 'Обработка...' : 'Оплатить и вызвать мастера'}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
