export interface Place {
	AvailableReturnPlaces: number[];
	Id: number;
	Price: number;
	Name: string;
	Category: string;
	Address: string;
	City: string;
	Country: string;
	BranchOfficeId: number;
	BranchOfficeName: string;
	BranchOfficeIATACode: string | null;
	IsFranchise: boolean;
	Latitude: number;
	Longitude: number;
	CanAddCustomAddress: boolean;
	IsCustomAddress: boolean;
	AvailableOperationOptions: string;
}