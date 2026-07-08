export class CreateBookingDto {
  agentName: string | undefined;
  agentContact: string | undefined;
  roomsCount: number | undefined;
  roomType: string | undefined;
  facility: string | undefined;
  mealPlan: string | undefined;
  selfCooking?: number;
  checkIn: string | undefined;
  checkOut: string | undefined;
  remark?: string;
  branch: string | undefined;
  bookingStatus?: string;

  // NEW FIELDS
  roomCharges?: number;
  kitchenCharges?: number;
  diningCharges?: number;
  currency?: string;
  heads?: number;
  extraPersonCharges?: number;
  childrenCount?: number;
  childrenBelow10?: number;
  price?: number;
}

export class UpdateBookingDto {
  agentName?: string;
  agentContact?: string;
  roomsCount?: number;
  roomType?: string;
  facility?: string;
  mealPlan?: string;
  selfCooking?: number;
  checkIn?: string;
  checkOut?: string;
  remark?: string;
  branch?: string;
  bookingStatus?: string;

  // NEW FIELDS
  roomCharges?: number;
  kitchenCharges?: number;
  diningCharges?: number;
  currency?: string;
  heads?: number;
  extraPersonCharges?: number;
  childrenCount?: number;
  childrenBelow10?: number;
  price?: number;
}

export class BookingFilterDto {
  branch?: string;
  from?: string;
  to?: string;
  status?: string;
  guestName?: string;
  roomType?: string;
  page?: number;
  limit?: number;
}