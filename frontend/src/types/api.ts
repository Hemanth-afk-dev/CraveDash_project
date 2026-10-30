export interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone: string;
  available: boolean;
  imageUrl?: string | null;
}

export interface MenuItem {
  id: number;
  restaurantId: number;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  imageUrl?: string | null;
}

export interface LoginResponse {
  token: string;
  type: string;
  customer: Customer;
}

export interface Customer {
  id: number;
  email: string;
  displayName: string;
}

export interface PaymentResponse {
  paymentId: number;
  orderId: number;
  userId: number;
  amount: number;
  paymentMethod: string;
  status: string;
  paymentDate: string | null;
}
