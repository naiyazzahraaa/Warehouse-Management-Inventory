import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryItem, TransactionType } from '../types';
import { db } from '../services/db';
import { DigitalBinCard } from './DigitalBinCard';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

interface BinCardPageProps {
  activeItem: InventoryItem | null;
  setActiveItem: (item: InventoryItem | null) => void;
  onRecordTransaction: (item: InventoryItem, type: TransactionType) => void;
  onEditItem: (item: InventoryItem) => void;
}

export const BinCardPage: React.FC<BinCardPageProps> = ({
  activeItem,
  setActiveItem,
  onRecordTransaction,
  onEditItem,
}) => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(!activeItem || (!!id && activeItem.id !== id && activeItem.material_code !== id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!id) {
      if (!activeItem) {
        navigate('/items', { replace: true });
      }
      return;
    }

    // If activeItem is already loaded and matches id or material_code
    if (activeItem && (activeItem.id === id || activeItem.material_code.toLowerCase() === id.toLowerCase())) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Try finding by item ID first, then by material_code
    db.getItemById(id).then(async (found) => {
      if (isCancelled) return;
      if (found) {
        setActiveItem(found);
        setLoading(false);
      } else {
        const byCode = await db.getItemByMaterialCode(id);
        if (isCancelled) return;
        if (byCode) {
          setActiveItem(byCode);
          setLoading(false);
        } else {
          setError(`Barang dengan ID atau kode '${id}' tidak ditemukan di sistem.`);
          setLoading(false);
        }
      }
    }).catch((err) => {
      if (isCancelled) return;
      setError(err.message || 'Gagal memuat kartu barang.');
      setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [id, activeItem, setActiveItem, navigate]);

  // Real-time listener: refresh active item when Firestore updates stock or details
  useEffect(() => {
    if (!activeItem?.id) return;
    const unsubscribe = db.subscribe(() => {
      db.getItemById(activeItem.id).then((fresh) => {
        if (fresh) setActiveItem(fresh);
      }).catch(console.error);
    });
    return () => {
      unsubscribe();
    };
  }, [activeItem?.id, setActiveItem]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Memuat data Kartu Barang Digital (Bin Card)...</p>
      </div>
    );
  }

  if (error || !activeItem) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Kartu Barang Tidak Ditemukan</h3>
        <p className="text-xs text-slate-500">{error || 'Data barang belum dipilih atau tidak tersedia.'}</p>
        <button
          onClick={() => navigate('/items')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Master Barang</span>
        </button>
      </div>
    );
  }

  return (
    <DigitalBinCard
      item={activeItem}
      onBack={() => navigate('/items')}
      onRecordTransaction={(type) => onRecordTransaction(activeItem, type)}
      onEditItem={(item) => onEditItem(item)}
    />
  );
};
