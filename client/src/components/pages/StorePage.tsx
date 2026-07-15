import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore.js';
import axios from 'axios';
import toast from 'react-hot-toast';

interface StoreItem {
  id: string; type: string; name: string; icon: string;
  price: { blueEssence: number; rp: number; isFree: boolean };
  isOwned: boolean; category: string;
}

export default function StorePage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [category, setCategory] = useState('champions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/store/items').then(res => { setItems(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [category]);

  const handlePurchase = async (item: StoreItem, method: 'rp' | 'blue-essence') => {
    const currency = method === 'rp' ? user?.rp : user?.blueEssence;
    const price = method === 'rp' ? item.price.rp : item.price.blueEssence;

    if ((currency || 0) < price) {
      toast.error(`Not enough ${method === 'rp' ? 'RP' : 'Blue Essence'}`);
      return;
    }

    try {
      await axios.post('/store/purchase', { itemId: item.id, itemType: item.type, paymentMethod: method });
      toast.success(`Purchased ${item.name}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    }
  };

  const categories = [
    { id: 'champions', label: 'Champions', icon: '⚔' },
    { id: 'skins', label: 'Skins', icon: '🎨' },
    { id: 'wards', label: 'Ward Skins', icon: '👁' },
    { id: 'emotes', label: 'Emotes', icon: '😀' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-game text-4xl font-bold">STORE</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-primary-300">💎 {user?.blueEssence?.toLocaleString()}</span>
          <span className="text-yellow-400">🔶 {user?.rp?.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${category === cat.id ? 'bg-primary-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/40">Loading store...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(item => (
            <div key={item.id} className="card overflow-hidden">
              <img src={item.icon || `https://picsum.photos/seed/${item.id}/200/200`} alt={item.name}
                className="w-full aspect-square object-cover rounded-lg mb-2" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/200/200`; }} />
              <h3 className="font-game text-sm font-bold">{item.name}</h3>
              {item.isOwned ? (
                <span className="text-green-400 text-xs">✓ Owned</span>
              ) : (
                <div className="flex gap-1 mt-2">
                  {!item.price.isFree && (
                    <>
                      <button onClick={() => handlePurchase(item, 'blue-essence')} className="text-xs px-2 py-1 bg-primary-600/20 text-primary-400 rounded hover:bg-primary-600/30">
                        💎 {item.price.blueEssence}
                      </button>
                      <button onClick={() => handlePurchase(item, 'rp')} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30">
                        🔶 {item.price.rp}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
