import { CategoryInfo } from "./category";
import { Customer } from "./customer";
import { Place } from "./place";

export interface PriceItem {
    Id: number;
    IsBookingPrice: boolean;
    Description: string;
    Price: number;
    Type: number;
    TypeId: number;
    UnitPrice: number;
    Quantity: number;
    Payer: number;
}
  
// Additional info interface
export interface AdditionalInfo {
    Name: string;
    Description: string;
    ImagePath: string;
    IsPriceByDay: boolean;
    Price: number;
    MaxQuantityPerBooking: number;
    Type: string;
    Stock: number;
    Order: number;
    Id: number;
}
  
// Additional interface (contains AdditionalInfo + Quantity)
export interface Additional {
    Additional: AdditionalInfo;
    Quantity: number;
}
  
// Origin interface
export interface Origin {
    Id: number;
    Name: string;
}
  
// Price Details interface
export interface PriceDetails {
    Price: number;
    CustomerPrice: number;
    AgencyPrice: number;
    SalesCommission: number;
    Currency: string;
}
  
// Booking Attributes interface
export interface BookingAttributes {
    AdditionalAttributes: string;
    ORIGINAL_FromDate: string;
    ORIGINAL_ToDate: string;
    ORIGINAL_CategoryId: string;
    ORIGINAL_Price: string;
    ORIGINAL_TotalDays: string;
    ORIGINAL_CustomerPrice: string;
    ORIGINAL_AgencyPrice: string;
  }
  
// Booking interface
export interface Booking {
    Id: number;
    Version: any;
    Customer: Customer;
    Balance: number;
    TotalPayed: number;
    Extra: any;
    Promotion: any;
    IsQuotation: boolean;
    Car: any;
    Model: any;
    Category: CategoryInfo;
    FromDate: string;
    ToDate: string;
    DeliveryPlace: Place;
    ReturnPlace: Place;
    TotalDaysString: string;
    Price: number;
    AgencyPrice: number;
    CustomerPrice: number;
    Currency: string;
    Franchise: number;
    FranchiseDamage: number;
    FranchiseRollover: number;
    FranchiseTheft: number;
    FranchiseHail: number;
    TotalDays: number;
    IlimitedKm: boolean;
    MaxAllowedDistance: number;
    MaxAllowedDistanceByDay: number;
    HasFranchiseModifiers: boolean;
    WillLeaveCountry: boolean | null;
    AverageDayPrice: number;
    PriceItems: PriceItem[];
    Additionals: Additional[];
    CurrentStatus: number;
    CurrentStatusDate: string;
    DeliveryTransportationId: number | null;
    ReturnTransportationId: number | null;
    IsCustomerOver25: boolean;
    ExternalSystemId: string | null;
    PrepaidAmount: number;
    ElegibleSIPPCodeUpgrade: string | null;
    Attributes: BookingAttributes;
    ExchangeRate: number;
    DailyRate: number;
    HourlyRate: number;
    ExtraDayRate: number;
    ExtraHourRate: number;
    RatePlan: any;
    IsOnRequest: boolean;
    DeliveryInfo: any;
    DropoffInfo: any;
    Origin: Origin;
    CreationDate: string;
    PayedByAgency: number;
    PayedByCustomer: number;
    CommercialAgreementCode: string | null;
    PurchaseOrder: string | null;
    Brand: any;
    SalesCommision: number;
    IsTransfer: boolean;
    PriceDetails: PriceDetails;
    Agency: any;
    IsSelfCheckin: boolean;
    AvailablePromotions: any;
}
  
// Booking response type (array of bookings)
export type BookingResponse = Booking[];