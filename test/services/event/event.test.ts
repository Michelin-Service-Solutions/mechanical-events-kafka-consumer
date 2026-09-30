import { app } from '../../../src/app'
import { describe, test, expect, jest } from "@jest/globals"
import * as fetch from 'node-fetch'
import { Response } from 'node-fetch';
import { OnCallUpdateCase } from 'src/helpers/interfaces/message-declarations-ers';
import { CaseErsSchema } from 'src/services/publisher/publisher.schema';
import { EventType } from 'src/services/internals/event/event.class';
import { DataSourceErs } from 'src/helpers/data-source-ers';
import { OutputMainCase } from 'src/helpers/interfaces/oncall-declarations';


describe('Event Service', () => {
    const eventService = app.service('event');

    const mockOutputMainCase: OutputMainCase = {
      // Main case fields from PartialOutputMainCase
      caseNumber: "E482466",
      caseStatus: "ARRIVED",
      previousStatus: "DISPATCHED",
      statusTimeStamp: "2025-09-02T10:30:00.000Z",
      userName: "test@example.com",
      typeOfCase: "api-call",
      inboundProgram: "TEST_PROGRAM",
      inboundCallerStore: "Test City, TX",
      inboundStoreBillTo: "123456",
      inboundStoreShipTo: "654321",
      paymentMethod: "CREDIT",
      customerName: "Test Customer",
      accountNumber: "ACC123456",
      poNumber: "PO123456",
      refNumber: "REF123456",
      ticketNumber: "TKT123456",
      workOrderNumber: "WO123456",
      billingComment: "Test billing comment",
      servicingDealerBilltoName: "Test Dealer",
      servicingDealerStore: "STORE001",
      specialInstructions: "Test special instructions",
      delayedService: "false",
      delayedServiceNote: "",
      delayedServiceCompletionDate: "",
      delayedServiceDispatchDate: "",

      // Nested objects
      assetLocation: {
        address: "123 Test Street",
        city: "Test City",
        state: "TX",
        latitude: "30.1",
        longitude: "-90.7",
        zipCode: "12345",
        highway: "I-10",
        milemarker: "100"
      },
      etaDuration: {
        min: "30",
        max: "45"
      },
      fixpix: {
        sent: "true",
        sentTimestamp: "2025-09-02T10:15:00.000Z"
      },

      // Asset fields
      primaryUnitType: "TRUCK",
      primaryUnitNumber: "TRTA775",
      secondaryUnitType: "TRAILER",
      secondaryUnitNumber: "TR001",

      // Arrays
      contacts: [
        {
          contactName: "John Doe",
          contactPhone: "555-1234",
          contactType: "DRIVER",
          contactEmail: "john@example.com"
        }
      ],
      serviceData: [
        {
          servicingDealer: "Test Service Dealer",
          servicingDealerStore: "Test City, TX",
          servicingDealerCity: "Test City",
          servicingDealerState: "TX",
          servicingDealerCountry: "USA",
          servicingDealerZip: "12345",
          servicingDealerAddress: "456 Service Ave",
          servicingDealerShipto: "654321",
          servicingDealerBillto: "123456",
          contactedTime: "2025-09-02T10:00:00.000Z",
          techPhone: "555-5678",
          techName: "Mike Tech",
          servicingDealerDriveDistance: "15.5",
          servicingDealerDriveTime: "25",
          refusalAcceptedReason: "ACCEPTED",
          etaDuration: {
            min: "30",
            max: "45"
          }
        }
      ],
      requestedService: [
        {
          type: "request" as const,
          unitNumber: "TRTA775",
          action: "REPAIR",
          condition: "FLAT",
          position: "STEER_LEFT",
          axle: "STEER",
          tireSize: "295/75R22.5",
          tireSizeType: "STANDARD",
          tireBrand: "MICHELIN",
          treadDesign: "XDA2"
        }
      ],
      agreedService: [
        {
          type: "agreement" as const,
          unitNumber: "TRTA775",
          action: "REPAIR",
          condition: "FLAT",
          position: "STEER_LEFT",
          axle: "STEER",
          tireSize: "295/75R22.5",
          tireSizeType: "STANDARD",
          tireBrand: "MICHELIN",
          treadDesign: "XDA2"
        }
      ],
      suppliedService: [
        {
          type: "supplied" as const,
          unitNumber: "TRTA775",
          action: "REPAIR",
          condition: "FLAT",
          position: "STEER_LEFT",
          axle: "STEER",
          tireSize: "295/75R22.5",
          tireSizeType: "STANDARD",
          tireBrand: "MICHELIN",
          treadDesign: "XDA2"
        }
      ],
      caseNotes: [
        {
          notesText: "Driver contacted, ETA provided",
          noteTimeStamp: "2025-09-02T10:05:00.000Z",
          userName: "dispatcher@example.com"
        }
      ],
      linkedCalls: [
        {
          callType: "outbound",
          callTimestamp: "2025-09-02T10:00:00.000Z",
          phoneNumber: "555-1234",
          contactId: "contact123",
          userName: "dispatcher@example.com",
          callTo: "Driver"
        }
      ],
      notifications: [
        {
          sentTimestamp: "2025-09-02T10:02:00.000Z",
          notificationType: "STATUS_UPDATE",
          emailAddress: "customer@example.com"
        }
      ],
      delays: [
        {
          status: "ACTIVE",
          delayReason: "TRAFFIC",
          startTime: "2025-09-02T10:10:00.000Z",
          endTime: "2025-09-02T10:20:00.000Z",
          customReason: "Heavy traffic on I-10"
        }
      ],
      caseStatusHistory: [
        {
          changeDate: "2025-09-02T10:30:00.000Z",
          oldStatus: "DISPATCHED",
          newStatus: "ARRIVED",
          userEmail: "dispatcher@example.com"
        },
        {
          changeDate: "2025-09-02T09:00:00.000Z",
          oldStatus: "NEW",
          newStatus: "DISPATCHED",
          userEmail: "dispatcher@example.com"
        }
      ],
      customerProfile: {
        fleetContactsAvailable: true,
        driverAuthorized: true,
        poRequired: false,
        tirePreferences: true,
        wheelPreferences: false,
        emailPreferences: true
      },
      flags: {
        digitalInitiated: null,
        autoDispatch: false,
        timeOut: false,
        dealerDecline: false,
        noAnswer: false,
        fullSuccessDigitalEvent: false,
        notUsed: true,
        fullyDigitalEvent: false,
        dealerRollOver: null,
        haasAlert: false,
        duplicateEvents: null,
        cancelledBillable: false,
      }
    };

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('registered the service', () => {
        const service = app.service('event')

        expect(service).not.toBeNull();
    })
   
        const onCallUpdateCase: OnCallUpdateCase = {
            case_number: "E482466",
            status: "arrived",
            id: "9bedc57a-abad-4022-b656-a7eb48b2b62b",
            previous_id: '',
            previous_case_number: '',
            previous_inserted_at: '',
            previous_updated_at: '',
            previous_status: '',
            previous_assigned_to_id: '',
            previous_created_by_id: '',
            previous_fixpix_push_result: '',
            previous_billable: '',
            previous_electronic_service_request: '',
            previous_updated_case_data: '',
            previous_use_asset_coordinates_for_travel_estimation: '',
            previous_has_failed_automated_call: ''
        }
    


    const updateCase = {
        "EventNumber": "8811646",
        "ReportingGroup": "Unscheduled Maintenance",
        "ReportingCategory": "Maintenance",
        "EventMonth": "July",
        "EventYear": "2025",
        "EventDate": "2025-07-15T23:22:00.000Z",
        "Event_Address": "935 LA 641",
        "Event_City": "GRAMERCY",
        "Event_State": "LA",
        "Event_Country": "USA",
        "CustomerPoNumber": "1572935",
        "ServiceDateTime": "2025-07-15T23:22:00.000Z",
        "EstimatedVendorArrival": "2025-07-16T01:32:00.000Z",
        "RepairStarted": "2025-07-16T01:00:00.000Z",
        "TopParentCode": "MOC0001",
        "TopParentName": "MICHELIN ON CALL",
        "ParentCode": "MOC4187",
        "ParentName": "MIC-Bill to Location 1264187",
        "CustomerCode": "MOCAF28",
        "CustomerName": "MIC-MPW TRANSPORTATION SERVICE",
        "BillTo": "1264187",
        "ShipTo": "1417128",
        "Unit": "TRTA775",
        "InitialTroubleCode": "153",
        "InitialTCDescription": "EXPENDABLE ITEMS",
        "AllocTermsFee": "0.00",
        "RepairEstimate": "71.11",
        "TroubleCodeAverage": "587.25",
        "IsAccident": "No",
        "PossibleDamage": "No",
        "PaidInFull": "No",
        "Complaint": "TRUCK TRTA775 ",
        "GVW": "0",
        "MasterRecord": "8811646",
        "WorkCompleteDate": "2025-07-16T02:00:00.000Z",
        "Correction": "AFTER HOURS CALL OUT TO GRAMERCY FOR",
        "VendorInvoicePosted": "2025-07-21T15:12:13.643Z",
        "CustInvoiceProcessed": "2025-07-21T15:17:26.263Z",
        "EventTotalTax": "0.00",
        "EventNatTire": "0.00",
        "EventNatTireFET": "0.00",
        "EventLatitude": "30.1",
        "EventLongitude": "-90.7",
        "OnYardEnRoute": "EnRoute",
        "IsUnitLoaded": "No",
        "Driver": "MATTHEW MCCLAIN",
        "Event_LastUpdated": "2025-07-22T09:53:48.000Z",

        "previous_EventNumber": "8811646",
        "previous_ReportingGroup": "Unscheduled Maintenance",
        "previous_ReportingCategory": "Maintenance",
        "previous_EventMonth": "July",
        "previous_EventYear": "2025",
        "previous_EventDate": "2025-07-15T23:22:00.000Z",
        "previous_Event_Address": "935 LA 641",
        "previous_Event_City": "GRAMERCY",
        "previous_Event_State": "LA",
        "previous_Event_Country": "USA",
        "previous_CustomerPoNumber": "1572935",
        "previous_ServiceDateTime": "2025-07-15T23:22:00.000Z",
        "previous_EstimatedVendorArrival": "2025-07-16T01:32:00.000Z",
        "previous_RepairStarted": "2025-07-16T01:00:00.000Z",
        "previous_TopParentCode": "MOC0001",
        "previous_TopParentName": "MICHELIN ON CALL",
        "previous_ParentCode": "MOC4187",
        "previous_ParentName": "MIC-Bill to Location 1264187",
        "previous_CustomerCode": "MOCAF28",
        "previous_CustomerName": "MIC-MPW TRANSPORTATION SERVICE",
        "previous_BillTo": "1264187",
        "previous_ShipTo": "1417128",
        "previous_Unit": "TRTA775",
        "previous_InitialTroubleCode": "153",
        "previous_InitialTCDescription": "EXPENDABLE ITEMS",
        "previous_AllocTermsFee": "0.00",
        "previous_RepairEstimate": "71.11",
        "previous_TroubleCodeAverage": "587.25",
        "previous_IsAccident": "No",
        "previous_PossibleDamage": "No",
        "previous_PaidInFull": "No",
        "previous_GVW": "0",
        "previous_MasterRecord": "8811646",
        "previous_WorkCompleteDate": "2025-07-16T02:00:00.000Z",
        "previous_VendorInvoicePosted": "2025-07-21T15:12:13.643Z",
        "previous_CustInvoiceProcessed": "2025-07-21T15:17:26.263Z",
        "previous_EventTotalTax": "0.00",
        "previous_EventNatTire": "0.00",
        "previous_EventNatTireFET": "0.00",
        "previous_EventLatitude": "30.1",
        "previous_EventLongitude": "-90.7",
        "previous_OnYardEnRoute": "EnRoute",
        "previous_IsUnitLoaded": "No",
        "previous_Driver": "MATTHEW MCCLAIN",
        "previous_Event_LastUpdated": "2025-07-22T09:53:48.000Z",
        "status": "dispatched"
    }



      test('Process Kafka Event ERS', async () => {

        async function sarasa(data: CaseErsSchema ) {
            console.log('calling publisher with', data);
        }

        const spyPPublishEvent = jest.spyOn(eventService, 'publishEvent').mockImplementation(sarasa);

        jest.spyOn(DataSourceErs, 'getOnCallCase').mockImplementation(() => Promise.resolve(mockOutputMainCase));

        const result = await eventService.create(onCallUpdateCase,{query:{type: EventType.ERS}});
        expect(result).toEqual(true);
        expect(spyPPublishEvent).toHaveBeenCalled();        

    });
});