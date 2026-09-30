
import { Type } from '@feathersjs/typebox'


export const assetLocationSchema = Type.Object({
  address: Type.Union([Type.String(), Type.Null()]),
  city: Type.String(),
  state: Type.String(),
  latitude: Type.String(),
  longitude: Type.String(),
  zipCode: Type.Union([Type.String(), Type.Null()]),
  highway: Type.Union([Type.String(), Type.Null()]),
  milemarker: Type.Union([Type.String(), Type.Null()]),
})

export const etaDurationSchema = Type.Object({
  min: Type.Union([Type.String(), Type.Null()]),
  max: Type.Union([Type.String(), Type.Null()]),
})

export const fixpixSchema = Type.Object({
  sent: Type.String(),
  sentTimestamp: Type.Union([Type.String(), Type.Null()]),
})

export const contactSchema = Type.Object({
  contactName: Type.String(),
  contactPhone: Type.String(),
  contactType: Type.String(),
  contactEmail: Type.Union([Type.String(), Type.Null()]),
})

export const requestedServiceSchema = Type.Object({
  type: Type.String(),
  unitNumber: Type.String(),
  action: Type.String(),
  condition: Type.String(),
  position: Type.String(),
  axle: Type.String(),
  tireSize: Type.String(),
  tireSizeType: Type.String(),
  tireBrand: Type.String(),
  treadDesign: Type.String(),
})

export const serviceDataSchema = Type.Object({
  servicingDealer: Type.String(),
  servicingDealerStore: Type.String(),
  servicingDealerCity: Type.String(),
  servicingDealerState: Type.String(),
  servicingDealerCountry: Type.String(),
  servicingDealerZip: Type.String(),
  servicingDealerAddress: Type.String(),
  servicingDealerShipto: Type.String(),
  servicingDealerBillto: Type.String(),
  contactedTime: Type.String(),
  techPhone: Type.String(),
  techName: Type.String(),
  servicingDealerDriveDistance: Type.String(),
  servicingDealerDriveTime: Type.String(),
  refusalAcceptedReason: Type.String(),
  etaDuration: etaDurationSchema,
})

export const caseNoteSchema = Type.Object({
  notesText: Type.String(),
  noteTimeStamp: Type.String(),
  userName: Type.String(),
})

export const linkedCallSchema = Type.Object({
  callType: Type.String(),
  callTimestamp: Type.String(),
  phoneNumber: Type.String(),
  contactId: Type.String(),
  userName: Type.String(),
  callTo: Type.String(),
})

export const notificationSchema = Type.Object({
  sentTimestamp: Type.String(),
  notificationType: Type.String(),
  emailAddress: Type.String(),
})

export const delaySchema = Type.Object({
  status: Type.String(),
  delayReason: Type.String(),
  startTime: Type.String(),
  endTime: Type.String(),
  customReason: Type.String(),
})

export const customerPreferencesSchema = Type.Object({
  fleetContactsAvailable: Type.Union([Type.Boolean(), Type.Null()]),
  driverAuthorized: Type.Union([Type.Boolean(), Type.Null()]),
  poRequired: Type.Union([Type.Boolean(), Type.Null()]),
  tirePreferences: Type.Union([Type.Boolean(), Type.Null()]),
  wheelPreferences: Type.Union([Type.Boolean(), Type.Null()]),
  emailPreferences: Type.Union([Type.Boolean(), Type.Null()]),
})

export const caseStatusHistorySchema = Type.Object({
  changeDate: Type.String(),
  oldStatus: Type.Union([Type.String(), Type.Null()]),
  newStatus: Type.String(),
  userEmail: Type.String(),
})

export const caseErsSchema = Type.Object({
  // Main case fields
  caseNumber: Type.String(),
  caseStatus: Type.String(),
}, { $id: 'CaseErsSchema', additionalProperties: true })



