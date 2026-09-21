import * as XLSX from 'xlsx';
import { Transaction, User, InventoryItem } from '../types';
import { formatUnit } from './units';
import { formatDateTime24h } from './dateFormat';

/**
 * Export specific user's transaction history to Excel (.xlsx) file
 */
export function exportUserTransactionsToExcel(
  transactions: Transaction[],
  user: User
): { success: boolean; count: number; filename: string } {
  const rows = transactions.map((tx, idx) => {
    const dateFormatted = formatDateTime24h(tx.transaction_date);

    return {
      'No': idx + 1,
      'Waktu Transaksi': dateFormatted,
      'Kode Material': tx.material_code,
      'Nama Barang': tx.item_name,
      'Tipe Mutasi': tx.transaction_type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
      'Jumlah Mutasi': tx.quantity,
      'Saldo Akhir Stok': tx.balance_after,
      'Nomor Dokumen': tx.doc_ref || '-',
      'Nama Petugas (PIC)': tx.pic_name,
      'Keterangan / Keperluan': tx.notes || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for polished presentation
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 20 }, // Waktu Transaksi
    { wch: 24 }, // Kode Material
    { wch: 36 }, // Nama Barang
    { wch: 16 }, // Tipe Mutasi
    { wch: 14 }, // Jumlah Mutasi
    { wch: 16 }, // Saldo Akhir Stok
    { wch: 22 }, // Nomor Dokumen
    { wch: 26 }, // Petugas
    { wch: 40 }, // Keterangan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Transaksi');

  // Generate filename with user username and timestamp
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filename = `Riwayat_Transaksi_${user.username.replace(/[^a-zA-Z0-9_]/g, '')}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);

  return { success: true, count: transactions.length, filename };
}

/**
 * Export all transactions to Excel
 */
export function exportAllTransactionsToExcel(
  transactions: Transaction[]
): { success: boolean; count: number; filename: string } {
  const rows = transactions.map((tx, idx) => {
    const dateFormatted = formatDateTime24h(tx.transaction_date);

    return {
      'No': idx + 1,
      'Waktu Transaksi': dateFormatted,
      'Kode Material': tx.material_code,
      'Nama Barang': tx.item_name,
      'Tipe Mutasi': tx.transaction_type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
      'Jumlah Mutasi': tx.quantity,
      'Saldo Akhir Stok': tx.balance_after,
      'Nomor Dokumen': tx.doc_ref || '-',
      'Nama Petugas (PIC)': tx.pic_name,
      'Keterangan / Keperluan': tx.notes || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 24 },
    { wch: 36 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 26 },
    { wch: 40 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Semua Transaksi');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filename = `Riwayat_Seluruh_Transaksi_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);

  return { success: true, count: transactions.length, filename };
}

/**
 * Export inventory items (Master Barang) to Excel (.xlsx) file
 */
export function exportInventoryItemsToExcel(
  items: InventoryItem[]
): { success: boolean; count: number; filename: string } {
  const rows = items.map((item, idx) => {
    const isOut = item.current_stock <= 0;
    const isLow = item.current_stock > 0 && item.current_stock <= item.min_stock;
    const stockStatus = isOut ? 'HABIS' : isLow ? 'MENIPIS (KRITIS)' : 'AMAN';
    const unitFormatted = formatUnit(item.unit);

    return {
      'No': idx + 1,
      'Kode Material (18 Digit)': item.material_code,
      'Nama Barang': item.name,
      'Kategori': item.category,
      'Deskripsi / Spesifikasi': item.description || '-',
      'Bin Location': item.location,
      'Stok Saat Ini': item.current_stock,
      'Satuan Unit': unitFormatted,
      'Batas Minimum Stok': item.min_stock,
      'Status Stok': stockStatus,
      'Terakhir Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 24 }, // Kode Material
    { wch: 38 }, // Nama Barang
    { wch: 22 }, // Kategori
    { wch: 42 }, // Deskripsi
    { wch: 18 }, // Bin Location
    { wch: 14 }, // Stok Saat Ini
    { wch: 16 }, // Satuan Unit
    { wch: 18 }, // Batas Minimum Stok
    { wch: 16 }, // Status Stok
    { wch: 20 }, // Terakhir Diperbarui
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Barang');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filename = `Master_Barang_Logistik_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);

  return { success: true, count: items.length, filename };
}

