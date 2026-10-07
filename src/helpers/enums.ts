export enum MechanicalCaseStatus {
    New = "new",
    Dispatched = "dispatched",
    EnRoute = "en_route",
    Arrived = "arrived",
    Rolling = "rolling",
    Closed = "closed",
}

export interface MechanicalCaseRecord {
    PaidInFull?: string | null;
    WorkCompleteDate?: string | null;
    RepairStarted?: string | null;
    EstimatedVendorArrival?: string | null;
    ServiceDateTime?: string | null;
}

export function getMechanicalCaseStatus(caseRecord: MechanicalCaseRecord): MechanicalCaseStatus {
    if (caseRecord.PaidInFull === "Yes") return MechanicalCaseStatus.Closed;
    if (caseRecord.WorkCompleteDate) return MechanicalCaseStatus.Rolling;
    if (caseRecord.RepairStarted) return MechanicalCaseStatus.Arrived;
    if (caseRecord.EstimatedVendorArrival) return MechanicalCaseStatus.EnRoute;
    if (caseRecord.ServiceDateTime) return MechanicalCaseStatus.Dispatched;
    return MechanicalCaseStatus.New;
}
