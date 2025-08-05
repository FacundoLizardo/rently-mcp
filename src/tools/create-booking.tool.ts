import { z } from "zod";
import { rentlyClient } from "../rently.client";
import type { BookingResponse, Additional } from "../types/booking";
import type { Place } from "../types/place";
import type { CategoriesResponse, Category, Model } from "../types/category";
import type { CustomerResultsResponse } from "../types/customer";

interface CreateBookingParams {
    token?: string;
    idVehiculo: string;
    idReserva: string;
    idRetiro?: string;
    Name: string;
    LastName: string;
    DocumentId: string;
    DocumentTypeId: number;
    EmailAddress: string;
    retiro: string;
    devolucion: string;
    es_reserva: boolean;
    adicionales?: string;
    BirthDate?: string;
    DriverLicenceNumber?: string;
    DriverLicenseExpiration?: string;
    Address?: string;
    ZipCode?: string;
    CellPhone?: string;
    conversationId?: string;
    datos_adicionales?: string;
}

export const createBookingTool = {
    name: "create_booking",
    description: "Create a vehicle booking (quotation or reservation) with customer and vehicle details",
    parameters: {
        token: z.string().optional().describe("Optional authentication token (will auto-refresh if not provided)"),
        idVehiculo: z.string().describe("Vehicle category ID"),
        idReserva: z.string().describe("Pickup location ID"),
        idRetiro: z.string().optional().describe("Return location ID (optional, defaults to pickup location)"),
        Name: z.string().describe("Customer first name"),
        LastName: z.string().describe("Customer last name"),
        DocumentId: z.string().describe("Customer document ID"),
        DocumentTypeId: z.number().default(1).describe("Document type ID (default: 1)"),
        EmailAddress: z.string().email().describe("Customer email address"),
        retiro: z.string().describe("Pickup date and time (ISO format: 2025-09-20T08:00:00)"),
        devolucion: z.string().describe("Return date and time (ISO format: 2025-09-27T08:00:00)"),
        es_reserva: z.boolean().default(false).describe("true for reservation, false for quotation"),
        adicionales: z.string().optional().default("[]").describe("Additional services as JSON string array"),
        BirthDate: z.string().optional().describe("Customer birth date"),
        DriverLicenceNumber: z.string().optional().describe("Driver license number"),
        DriverLicenseExpiration: z.string().optional().describe("Driver license expiration"),
        Address: z.string().optional().describe("Customer address"),
        ZipCode: z.string().optional().describe("Customer zip code"),
        CellPhone: z.string().optional().describe("Customer cell phone"),
        conversationId: z.string().optional().describe("Conversation ID for tracking"),
        datos_adicionales: z.string().optional().describe("Additional data")
    },
    handler: async (params: CreateBookingParams) => {
        try {
            let adicionalesArray = [];
            try {
                adicionalesArray = JSON.parse(params.adicionales || "[]");
            } catch (error) {
                adicionalesArray = [];
            }

            // Get vehicle and category information
            const categories = await rentlyClient.get<Category[]>('/api/categories', { token: params.token });

            let vehicleModel = null;
            for (const category of categories) {
                for (const model of category.Models || []) {
                    if (model.Id === parseInt(params.idVehiculo)) {
                        vehicleModel = model;
                        break;
                    }
                }
                if (vehicleModel) break;
            }

            if (!vehicleModel) {
                throw new Error(`Vehicle model not found for ID: ${params.idVehiculo}`);
            }

            // Get places information
            const places = await rentlyClient.get<Place[]>('/api/places', { token: params.token });

            const pickupPlace = places.find((p: any) => String(p.Id) === String(params.idReserva));
            const returnPlace = params.idRetiro 
                ? places.find((p: any) => String(p.Id) === String(params.idRetiro))
                : pickupPlace;

            if (!pickupPlace) {
                throw new Error(`Pickup location not found for ID: ${params.idReserva}`);
            }

            const cleanPlace = (place: Place) => {
                const { AvailableReturnPlaces, ...cleanedPlace } = place;
                return cleanedPlace;
            };

            const deliveryPlace = cleanPlace(pickupPlace);
            const returnPlaceClean = returnPlace ? cleanPlace(returnPlace) : cleanPlace(pickupPlace);

            // Check for existing customer if it's a reservation
            let customerData: any = null;
            let isExistingCustomer = false;

            if (params.es_reserva) {
                try {
                    const customerResponse = await rentlyClient.get<CustomerResultsResponse>(
                        `/api/customers?filter=${params.DocumentId}`,
                        { token: params.token }
                    );
                    if (customerResponse.Results?.length > 0) {
                        isExistingCustomer = true;
                        customerData = customerResponse.Results[0];
                    }
                } catch (error) {
                    // Continue without existing customer data
                }
            }

            // Prepare customer object
            const customer = isExistingCustomer && customerData ? {
                Id: customerData.Id,
                GlobalId: customerData.GlobalId || "00000000-0000-0000-0000-000000000000",
                Name: customerData.Name || params.Name,
                LastName: customerData.Lastname || params.LastName,
                DocumentId: customerData.DocumentId || params.DocumentId,
                DocumentTypeId: customerData.DocumentTypeId || params.DocumentTypeId,
                EmailAddress: customerData.EmailAddress || params.EmailAddress,
                CellPhone: customerData.CellPhone || params.CellPhone || "",
                Address: customerData.Address || params.Address || "",
                AddressNumber: customerData.AddressNumber || "",
                AddressDepartment: customerData.AddressDepartment || "",
                Country: customerData.Country || "",
                BirthDate: customerData.BirthDate || params.BirthDate || "",
                ZipCode: customerData.ZipCode || params.ZipCode || "",
                CreditCards: customerData.CreditCards || [],
                Memberships: customerData.Memberships || [],
                Age: customerData.Age || 18,
                DriverLicenceNumber: customerData.DriverLicenceNumber || params.DriverLicenceNumber || "",
                DriverLicenseExpiration: customerData.DriverLicenseExpiration || params.DriverLicenseExpiration || "",
                IsCompany: customerData.IsCompany || false,
                IsAgency: customerData.IsAgency || false,
                IsProvider: customerData.IsProvider || false,
                IsHotel: customerData.IsHotel || false,
                CommercialAgreements: customerData.CommercialAgreements || [],
                HasWebLogin: customerData.HasWebLogin || false
            } : {
                Id: 0,
                GlobalId: "00000000-0000-0000-0000-000000000000",
                Name: params.Name,
                LastName: params.LastName,
                DocumentId: params.DocumentId,
                DocumentTypeId: params.DocumentTypeId,
                EmailAddress: params.EmailAddress,
                CellPhone: params.CellPhone || "",
                Address: params.Address || "",
                AddressNumber: "",
                AddressDepartment: "",
                Country: "",
                BirthDate: params.BirthDate || "",
                ZipCode: params.ZipCode || "",
                CreditCards: [],
                Memberships: [],
                Age: 30,
                DriverLicenceNumber: params.DriverLicenceNumber || "",
                DriverLicenseExpiration: params.DriverLicenseExpiration || "",
                IsCompany: false,
                IsAgency: false,
                IsProvider: false,
                IsHotel: false,
                CommercialAgreements: [],
                HasWebLogin: false
            };

            // Prepare booking payload
            const bookingPayload = {
                FullResponse: true,
                IsFixedPrice: false,
                IsPriceAllInclusive: false,
                ForceExchangeRate: false,
                Id: 0,
                Customer: customer,
                Balance: 0,
                TotalPayed: 0,
                IsQuotation: !params.es_reserva,
                Car: {
                    Model: {
                        Franchise: vehicleModel.Franchise,
                        FranchiseDamage: vehicleModel.FranchiseDamage,
                        FranchiseRollover: vehicleModel.FranchiseRollover,
                        FranchiseTheft: vehicleModel.FranchiseTheft,
                        FranchiseHail: vehicleModel.FranchiseHail,
                        Doors: vehicleModel.Doors,
                        Passengers: vehicleModel.Passengers,
                        BigLuggage: vehicleModel.BigLuggage,
                        SmallLuggage: vehicleModel.SmallLuggage,
                        Steering: vehicleModel.Steering,
                        Gearbox: vehicleModel.Gearbox,
                        Multimedia: vehicleModel.Multimedia,
                        AirConditioner: vehicleModel.AirConditioner,
                        DailyPrice: vehicleModel.DailyPrice,
                        ModelAttributes: vehicleModel.ModelAttributes,
                        LowerPrice: vehicleModel.LowerPrice,
                        CreationDate: vehicleModel.CreationDate,
                        Id: vehicleModel.Id,
                        SIPP: vehicleModel.SIPP
                    },
                    CurrentBranchOfficeId: 0,
                    CurrentKms: 0,
                    Gasoline: 0,
                    Year: 0,
                    CreationDate: "0001-01-01T00:00:00"
                },
                Category: {
                    Id: vehicleModel.Category.Id,
                    Order: vehicleModel.Category.Order,
                    Franchise: vehicleModel.Category.Franchise,
                    FranchiseDamage: vehicleModel.Category.FranchiseDamage,
                    FranchiseRollover: vehicleModel.Category.FranchiseRollover,
                    FranchiseTheft: vehicleModel.Category.FranchiseTheft,
                    FranchiseHail: vehicleModel.Category.FranchiseHail
                },
                FromDate: params.retiro,
                ToDate: params.devolucion,
                DeliveryPlace: deliveryPlace,
                ReturnPlace: returnPlaceClean,
                Price: 0,
                AgencyPrice: 0,
                CustomerPrice: 0,
                Currency: "ARS",
                TotalDays: 0,
                IlimitedKm: false,
                MaxAllowedDistance: 0,
                MaxAllowedDistanceByDay: 0,
                HasFranchiseModifiers: false,
                AverageDayPrice: 0,
                PriceItems: [],
                Additionals: adicionalesArray,
                CurrentStatus: 0,
                CurrentStatusDate: new Date().toISOString(),
                IsCustomerOver25: false,
                PrepaidAmount: 0,
                Attributes: {},
                DailyRate: 0,
                HourlyRate: 0,
                ExtraDayRate: 0,
                ExtraHourRate: 0,
                IsOnRequest: false,
                CreationDate: new Date().toISOString(),
                PayedByAgency: 0,
                PayedByCustomer: 0,
                SalesCommision: 0,
                IsTransfer: false,
                IsSelfCheckin: false
            };

            // Create booking
            const bookingResult = await rentlyClient.post<BookingResponse>('/api/booking/book', {
                body: bookingPayload,
                token: params.token
            });

            // Format response message
            const formatResponse = (booking: BookingResponse) => {
                const reservaData = Array.isArray(booking) ? booking[0] : booking;
                
                const customer = reservaData.Customer || {};
                const titular = `${customer.Firstname || customer.Name || ''} ${customer.Lastname || ''}`.trim();
                const idReserva = reservaData.Id || '';
                
                const categoria = reservaData.Category?.Name || 'Categoría no especificada';
                const vehiculo = vehicleModel.Description || categoria;
                
                const retiroLugar = reservaData.DeliveryPlace?.Name || '';
                const devolucionLugar = reservaData.ReturnPlace?.Name || '';
                
                const fromDate = new Date(reservaData.FromDate);
                const toDate = new Date(reservaData.ToDate);
                
                const retiroFechaHora = fromDate.toLocaleDateString('es-AR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric' 
                }) + ' - ' + fromDate.toLocaleTimeString('es-AR', { 
                    hour: '2-digit', minute: '2-digit', hour12: false 
                }) + 'hs';
                
                const devolucionFechaHora = toDate.toLocaleDateString('es-AR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric' 
                }) + ' - ' + toDate.toLocaleTimeString('es-AR', { 
                    hour: '2-digit', minute: '2-digit', hour12: false 
                }) + 'hs';
                
                const adicionales = reservaData.Additionals || [];
                let adicionalesTexto = '';
                adicionales.forEach((adicional: Additional) => {
                    if (adicional.Additional && 
                        adicional.Additional.Name !== 'Cargo servicio en Aeropuerto' &&
                        adicional.Additional.Name !== 'IVA Diarias' &&
                        adicional.Additional.Name !== 'IVA Adicionales') {
                        adicionalesTexto += `Adicional: ${adicional.Additional.Name}\n`;
                    }
                });
                
                const totalBasico = reservaData.Price || reservaData.CustomerPrice || 0;
                const deposito = reservaData.Franchise || reservaData.Category?.Franchise || 0;
                const franquiciaDanos = reservaData.FranchiseDamage || reservaData.Category?.FranchiseDamage || 0;
                const franquiciaVuelcos = reservaData.FranchiseRollover || reservaData.Category?.FranchiseRollover || 0;
                const franquiciaRobo = reservaData.FranchiseTheft || reservaData.Category?.FranchiseTheft || 0;
                const franquiciaGranizo = reservaData.FranchiseHail || reservaData.Category?.FranchiseHail || 0;
                
                const totalIntermedio = totalBasico * 1.18;
                const totalMaximo = totalBasico * 1.28;
                const depositoReducido = deposito * 0.5;
                const franquiciaDanosIntermedia = franquiciaDanos * 0.5;
                
                const formatearPrecio = (precio: number) => {
                    return 'ARS $ ' + new Intl.NumberFormat('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(precio);
                };
                
                const formatearNumero = (numero: number) => {
                    return '$' + new Intl.NumberFormat('es-AR').format(numero);
                };
                
                const tipoOperacion = reservaData.IsQuotation ? 'Cotización' : 'Reserva';
                
                return `*${tipoOperacion} - ${categoria}*
                    Entrega: ${retiroFechaHora} - ${retiroLugar}
                    Devolución: ${devolucionFechaHora} - ${devolucionLugar}
                    KILÓMETROS LIBRES en todas las opciones
                    ${adicionalesTexto}
                    Opción 1 – Cobertura Básica
                    Valor: *${formatearPrecio(totalBasico)}* | Depósito: ${formatearPrecio(deposito)}
                    Franquicias: Daños: ${formatearNumero(franquiciaDanos)} – Vuelcos: ${formatearNumero(franquiciaVuelcos)} – Robo: ${formatearNumero(franquiciaRobo)} – Granizo: ${formatearNumero(franquiciaGranizo)}
                    
                    Opción 2 – Cobertura Intermedia
                    Valor: *${formatearPrecio(totalIntermedio)}* | Depósito: ${formatearPrecio(deposito)}
                    Franquicias: Daños: ${formatearNumero(franquiciaDanosIntermedia)} – Vuelcos: ${formatearNumero(franquiciaVuelcos)} – Robo: ${formatearNumero(franquiciaRobo)} – Granizo: ${formatearNumero(franquiciaGranizo)}
                    
                    Opción 3 – Cobertura Máxima
                    Valor: *${formatearPrecio(totalMaximo)}* | Depósito: ${formatearPrecio(depositoReducido)}
                    Franquicias: Daños: ${formatearNumero(0)} – Vuelcos: ${formatearNumero(0)} – Robo: ${formatearNumero(franquiciaRobo)} – Granizo: ${formatearNumero(0)}
                    
                    Tu número de reserva es ${idReserva}. Si necesitás hacer alguna consulta o modificación, podés usar este número. ¡Espero que disfrutes tu viaje! 😊`;
            };

            const formattedMessage = formatResponse(bookingResult);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        message: formattedMessage,
                        booking: bookingResult,
                        isQuotation: !params.es_reserva,
                        isExistingCustomer,
                        conversationId: params.conversationId
                    }, null, 2)
                }]
            };

        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error occurred",
                        stage: "booking_creation"
                    }, null, 2)
                }],
                isError: true
            };
        }
    }
};
