export interface Customer {
    Id: number;
    GlobalId: string;
    Name: string;
    Lastname: string;
    Firstname: string;
    DocumentId: string;
    DocumentTypeId: number;
    EmailAddress: string;
    CellPhone: string | null;
    Address: string | null;
    AddressNumber: string | null;
    AddressDepartment: string | null;
    Country: string | null;
    BirthDate: string | null;
    CreditCards: any[]; // Can be typed more specifically if you have examples
    Memberships: any[]; // Can be typed more specifically if you have examples
    Age: number | null;
    DriverLicenceNumber: string | null;
    DriverLicenceCountry: string | null;
    DriverLicenseExpiration: string | null;
    ZipCode: string | null;
    FiscalConditionId: number | null;
    Notes: string | null;
    IsCompany: boolean;
    IsAgency: boolean;
    IsProvider: boolean;
    IsHotel: boolean;
    City: string | null;
    State: string | null;
    Region: string | null;
    CommercialAgreements: any[]; // Can be typed more specifically if you have examples
    HasWebLogin: boolean;
    IATACode: string | null;
    BirthCountry: string | null;
    BirthState: string | null;
    DriverLicenseIssuance: string | null;
    DriverLicenseState: string | null;
    DocumentIdIssuance: string | null;
    DocumentIdExpiration: string | null;
    DocumentIdIssuanceState: string | null;
    DocumentIdIssuanceCountry: string | null;
}

export interface CustomerSearchResult {
    Offset: number;
    Limit: number;
    Total: number;
    Results: Customer[];
}
  
  // Customer Results response type (array of search results)
export type CustomerResultsResponse = CustomerSearchResult