export interface Brand {
    Name: string;
}

export interface CategoryInfo {
    Id: number;
    Name: string;
    Order: number;
    PrincipalModelId: number;
    Franchise: number;
    FranchiseDamage: number;
    FranchiseRollover: number;
    FranchiseTheft: number;
    FranchiseHail: number;
    ImagePath: string;
}

export type CategoriesResponse = Category[];

export interface Category {
    Models: Model[];
    Id: number;
    Name: string;
    Order: number;
    PrincipalModelId: number;
    Franchise: number;
    FranchiseDamage: number;
    FranchiseRollover: number;
    FranchiseTheft: number;
    FranchiseHail: number;
    ImagePath: string;
}

export interface Model {
    Description: string;
    ImagePath: string;
    Franchise: number;
    FranchiseDamage: number;
    FranchiseRollover: number;
    FranchiseTheft: number;
    FranchiseHail: number;
    Brand: Brand;
    Doors: number;
    Passengers: number;
    BigLuggage: number;
    SmallLuggage: number;
    Steering: string;
    Gearbox: string;
    Multimedia: string;
    AirConditioner: string;
    DailyPrice: number;
    ModelAttributes: any[]; // Array of unknown structure, you can specify later
    LowerPrice: number;
    CreationDate: string; // ISO date string
    Id: number;
    Name: string;
    Category: CategoryInfo;
    SIPP: string;
}