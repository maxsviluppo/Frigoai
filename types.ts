
export interface InventoryItem {
  id: string;
  name: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
  category: 'fridge' | 'freezer' | 'dispensa';
  image?: string;
  dateAdded: string;
  notes?: string;
  onShoppingList?: boolean;
}

export interface ScanResult {
  name: string;
  barcode: string;
  brand?: string;
  category?: string;
}

export type ViewState = 'dashboard' | 'inventory' | 'scanner' | 'editor' | 'settings' | 'shopping';
