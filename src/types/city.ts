
export interface City {
  plateNumber: string; // plaka_kodu
  name: string; // il_adi
  districts: District[]; // ilceler
}

export interface District {
  code: string; // ilce_kodu
  name: string; // ilce_adi
}
