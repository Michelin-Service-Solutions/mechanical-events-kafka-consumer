type FilterNotStartingWith<Set, Needle extends string> = Set extends `${Needle}${infer X}` ? never : Set


export interface InputMainCase {
    caseNumber: string;
    caseStatus: string;
    previousStatus: string;
    statusTimeStamp: string;
    userName: string;
    typeOfCase: string;
    inboundProgram: string;
    inboundCallerStore: string;
    inboundStoreBillTo: string;
    inboundStoreShipTo: string;
    paymentMethod: string;
    customerName: string;
    accountNumber: string;
    poNumber: string;
    refNumber: string;
    ticketNumber: string;
    workOrderNumber: string;
    billingComment: string;
    servicingDealerBilltoName: string;
    servicingDealerStore: string;
    specialInstructions: string;
    delayedService: string;
    delayedServiceNote: string;
    delayedServiceCompletionDate: string;
    delayedServiceDispatchDate: string;
    locationValidatedByDriver?: boolean | null;
    duplicateEvents?: boolean | null;
    cancelledBillable?: boolean;

    assetLocation_address: string;
    assetLocation_city: string;
    assetLocation_state: string;
    assetLocation_latitude: string | null;
    assetLocation_longitude: string | null;
    assetLocation_zip: string;
    assetLocation_highway: string;
    assetLocation_milemaker: string;
    eta_min: string | null;
    eta_max: string | null;
    fixpix_sent: string;
    fixpix_sentTimestamp: string;    
}

export type FilteredMainCaseKeys = FilterNotStartingWith<keyof InputMainCase, 'assetLocation_' | 'eta_' | 'fixpix_'>
export type PartialOutputMainCase = Pick<InputMainCase, FilteredMainCaseKeys> & {
    etaDuration: etaDuration;
    assetLocation: AssetLocation;
    fixpix: FixPix;  

}

export interface DigitalInitiatedInfo {
    email: string;
    user_name: string;
}

export interface CaseFlags {
    digitalInitiated: DigitalInitiatedInfo | null;
    autoDispatch: boolean;
    timeOut: boolean;
    dealerDecline: boolean;
    noAnswer: boolean;
    fullSuccessDigitalEvent: boolean;
    notUsed: boolean;
    fullyDigitalEvent: boolean;
    dealerRollOver: boolean | null;
    haasAlert: boolean;
    duplicateEvents: boolean | null;
    cancelledBillable: boolean;
}

export interface OutputMainCase extends PartialOutputMainCase, Asset {
    customerProfile: CustomerPreferences;
    contacts: Contact[];
    serviceData: OutputServiceData[];
    requestedService: RequestedService[];
    agreedService: RequestedService[];
    suppliedService: RequestedService[];
    caseNotes: CaseNote[];
    linkedCalls: LinkedCall[];
    notifications: Notification[];
    delays: Delay[];
    caseStatusHistory: CaseStatusHistory[];
    flags: CaseFlags;
} 

export interface AssetLocation {
    address: string;
    city: string;
    state: string;
    latitude: string;
    longitude: string;
    zipCode: string;
    highway: string;
    milemarker: string;
}

export interface etaDuration {
    min: string | null;
    max: string | null;
}

export interface FixPix {
    sent: string;
    sentTimestamp: string;
}

export interface Contact {
    contactName: string;
    contactPhone: string;
    contactType: string;
    contactEmail: string;
}

export interface RequestedService {
    type: RequestedServiceType | AgreedServiceType | SuppliedServiceType;
    unitNumber: string;
    action: string;
    condition: string;
    position: string;
    axle: string;
    tireSize: string;
    tireSizeType: string;
    tireBrand: string;
    treadDesign: string;
}

export type RequestedServiceType = 'request';
export type AgreedServiceType = 'agreement';
export type SuppliedServiceType = 'supplied';

export interface InputServiceData {
    servicingDealer: string;
    servicingDealerStore: string;
    servicingDealerCity: string;
    servicingDealerState: string;
    servicingDealerCountry: string;
    servicingDealerZip: string;
    servicingDealerAddress: string;
    servicingDealerShipto: string;
    servicingDealerBillto: string;
    contactedTime: string;
    techPhone: string;
    techName: string;
    eta_min: string;
    eta_max: string;
    servicingDealerDriveDistance: string;
    servicingDealerDriveTime: string;
    refusalAcceptedReason: string;
}
export type FilteredServiceDataKeys = FilterNotStartingWith<keyof InputServiceData, 'eta_'>
export type OutputServiceData = Pick<InputServiceData, FilteredServiceDataKeys> & {
    etaDuration: etaDuration;
}

export interface CaseNote {
    notesText: string;
    noteTimeStamp: string;
    userName: string;
}

export interface LinkedCall {
    callType: string;
    callTimestamp: string;
    phoneNumber: string;
    contactId: string;
    userName: string;
    callTo: string;
}
export interface Notification {
    sentTimestamp: string;
    notificationType: string;
    emailAddress: string;
}
export interface Delay {
    status: string;
    delayReason: string;
    startTime: string;
    endTime: string;
    customReason: string;
}
export interface InputAsset {
    type: string;
    unitNumber: string;
    unitType: string;
}

export interface Asset {
    primaryUnitType: string,
    primaryUnitNumber: string,
    secondaryUnitType: string,
    secondaryUnitNumber: string,
}
export interface CustomerPreference {
    preferences: string;
}
export interface CustomerPreferences {
    fleetContactsAvailable: boolean;
    driverAuthorized: boolean;
    poRequired: boolean;
    tirePreferences: boolean;
    wheelPreferences: boolean;
    emailPreferences: boolean;
}

export interface CaseStatusChange {
    timestamp: string;
    oldStatus: string;
    newStatus: string;
}

export interface AuditLogs {
    sentTimestamp: string;
}

export interface CaseStatusHistory {
    changeDate: string;
    oldStatus: string;
    newStatus: string;
    userEmail: string;
}