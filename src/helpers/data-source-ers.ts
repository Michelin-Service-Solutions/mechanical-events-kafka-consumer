import { app } from "src/app";
import { uuid } from "aws-sdk/clients/customerprofiles";
import {
    Asset,
    CaseFlags,
    CaseNote,
    Contact,
    DigitalInitiatedInfo,
    InputMainCase,
    LinkedCall,
    OutputMainCase,
    RequestedService,
    InputServiceData,
    OutputServiceData,
    CustomerPreferences,
    InputAsset,
    PartialOutputMainCase,
    Notification,
    Delay,
    CaseStatusHistory
} from "./interfaces/oncall-declarations";
import { OnCallNewCase } from "./interfaces/message-declarations-ers";
import { OnCallCaseStatus } from "./enums";

export class DataSourceErs {

    private static getConfiguredMtvaSystemUserEmail(): string {
        return app.get('mtvaSystemUserEmail') as string;
    }


    private static getMiddlewareAuthToken(): Promise<string | null> {
        const config = app.get('middleware');

        return (async () => {
            try {
                const res = await fetch(`${config.url}/authentication`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: config.username,
                        password: config.password,
                        strategy: 'local',
                    }),
                });

                if (!res.ok) {
                    console.error('Middleware auth failed:', res.status, res.statusText);
                    return null;
                }

                const data = await res.json() as { accessToken?: string };
                return data.accessToken ?? null;
            } catch (e) {
                console.error('Middleware auth exception:', e);
                return null;
            }
        })();
    }

    private static async getOncallInboundProgramNumbersFromMiddleware(inboundProgramNumberId: number): Promise<boolean> {
        const config = app.get('middleware');

        try {
            const token = await DataSourceErs.getMiddlewareAuthToken();

            if (!token) {
                console.warn('Could not obtain middleware auth token; defaulting to false');
                return false;
            }

            const res = await fetch(`${config.url}/inboundProgramNumbers?id=${inboundProgramNumberId}&accountTypeId=104&isDisabled=false`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                console.error('Middleware inboundProgramNumbers query failed:', res.status, res.statusText);
                return false;
            }

            const response = await res.json() as { data?: unknown[] };

            console.log(`Middleware response for inboundProgramNumberId ${inboundProgramNumberId}:`, response);
            const data = response.data ?? [];
            return Array.isArray(data) && data.length > 0;
        } catch (e) {
            console.error('getOncallInboundProgramNumbersFromMiddleware exception:', e);
            return false;
        }
    }

    static async getFlagDealerRollOver(inboundProgramNumberId?: number | null): Promise<boolean | null> {
        if (typeof inboundProgramNumberId !== 'number') {
            return null;
        }

        return DataSourceErs.getOncallInboundProgramNumbersFromMiddleware(inboundProgramNumberId);
    }


    static async getMainCase(caseId: uuid, status: string | undefined): Promise<{ mainCase: PartialOutputMainCase }> {
        const db = app.get('oncallDBClient');

        //caseId = 'e68b447e-d633-4cee-8d6c-36e53eb825d5';
        try {
            console.log("Quering MainCase for case_id: ", caseId);

            const where = [`C.id = '${caseId}'`];
            if (status && status != OnCallCaseStatus.New) {
                where.push(`CSC.new_status = '${status}'`);
            }

            const res = await db.raw(`SELECT case_number AS "caseNumber",
            UPPER(coalesce(CSC.new_status,status)::text) AS "caseStatus",
            CSC.old_status AS "previousStatus",
            coalesce(CSC.timestamp, C.inserted_at) AS "statusTimeStamp",
            CASE WHEN CSCU.email IS NULL THEN UCB.email ELSE CSCU.email END AS "userName",
            CASE WHEN NOT c.electronic_service_request THEN 'call-in'
                 WHEN c.electronic_service_request = true AND UCB.external_id LIKE 'rest-api:rest-api:esd%' THEN 'esd'
                 ELSE 'api-call' END AS "typeOfCase" /* How the case was created */,
            C.inbound_program_name AS "inboundProgram",

            CASE WHEN c.inbound_program_ship_to IS NOT null THEN CONCAT(CUST.city, ', ', CUST.state) ELSE null END AS "inboundCallerStore",
            CIP.data::json#>>'{bill_to}' AS "inboundStoreBillTo",
            C.inbound_program_ship_to AS "inboundStoreShipTo",
            payment_method AS "paymentMethod",
            C.customer_name AS "customerName",
            C.customer_ship_to AS "accountNumber",
            billing_po_number AS "poNumber",
            billing_reference_number AS "refNumber",
            ticket_number AS "ticketNumber",
            billing_wo_number AS "workOrderNumber",
            billing_comment AS "billingComment",

            coalesce(D.bt_name, CD.name) AS "servicingDealerBilltoName",
            D.store_number AS "servicingDealerStore",

            C.asset_location_street_address AS "assetLocation_address",
            C.asset_location_city AS "assetLocation_city",
            C.asset_location_province AS "assetLocation_state",
            ST_Y(C.asset_location_coordinates) AS "assetLocation_latitude",
            ST_X(C.asset_location_coordinates) AS "assetLocation_longitude",
            C.asset_location_postal_code AS "assetLocation_zip",
            C.asset_location_highway AS "assetLocation_highway",
            C.asset_location_mile_marker AS "assetLocation_milemaker",

            DRE.min_minutes AS "eta_min",
            DRE.max_minutes AS "eta_max",

            C.special_instructions AS "specialInstructions",
            fixpix_push_result AS "fixpix_sent",
            null AS "fixpix_sentTimestamp", -- There's no place where that timestamp gets saved
            C.is_delayed_service as "delayedService",
            C.delayed_service_notes as "delayedServiceNote",
            C.delayed_service_scheduled_date as "delayedServiceCompletionDate",
            C.delayed_service_scheduled_dispatch_date as "delayedServiceDispatchDate",
            C.location_validated_by_driver_app AS "locationValidatedByDriver",
            -- C.duplicated AS "duplicateEvents",
            false AS "duplicateEvents", -- Force to false until column exists
            (C.billable AND C.status IN ('closed_canceled', 'canceled')) AS "cancelledBillable"

     FROM cases C
         LEFT JOIN case_status_changes CSC ON CSC.case_id = C.id
         LEFT JOIN users CSCU ON CSC.user_id = CSCU.id
         LEFT JOIN users UCB ON C.created_by_id = UCB.id
         LEFT JOIN case_customer_preferences CCP ON CCP.id = C.case_customer_preference_id
         LEFT JOIN dealers_response DR ON C.servicing_dealer_id = DR.id
         LEFT JOIN dealers_response_etas DRE on DR.eta_id = dre.id
         LEFT JOIN dealers D ON DR.dealer_id = D.id
         LEFT JOIN case_inbound_programs CIP ON CIP.case_id = C.id
         LEFT JOIN custom_dealers CD ON CD.id = DR.custom_dealer_id
         LEFT JOIN customers CUST ON C.inbound_program_ship_to = CUST.ship_to

     WHERE ${where.join(' AND ')}
     ORDER BY CSC.inserted_at DESC
     LIMIT 1;`);


            const mapMainCase = (
                {
                    assetLocation_address,
                    assetLocation_city,
                    assetLocation_state,
                    assetLocation_latitude,
                    assetLocation_longitude,
                    assetLocation_zip,
                    assetLocation_highway,
                    assetLocation_milemaker,
                    eta_min,
                    eta_max,
                    fixpix_sent,
                    fixpix_sentTimestamp,
                    ...values
                }: InputMainCase): PartialOutputMainCase => (
                {
                    assetLocation: {
                        address: assetLocation_address,
                        city: assetLocation_city,
                        state: assetLocation_state,
                        latitude: assetLocation_latitude?.toString() ?? '',
                        longitude: assetLocation_longitude?.toString() ?? '',
                        zipCode: assetLocation_zip,
                        highway: assetLocation_highway,
                        milemarker: assetLocation_milemaker,
                    },
                    etaDuration: {
                        min: eta_min,
                        max: eta_max

                    },
                    fixpix: {
                        sent: fixpix_sent,
                        sentTimestamp: fixpix_sentTimestamp,
                    },
                    ...values
                });

            console.log(JSON.stringify({
                id: `rawMainCaseQuery~${caseId}`,
                result: res.rows
            }));

            if (res.rows.length == 0) {
                throw new Error("Case-status not found");
            }

            return {
                mainCase: mapMainCase(res.rows[0]),
            };

        } catch (e) {
            console.error("Main Case query exception : ", e);
            throw e;
        }
    }

    static async getContacts(caseId: uuid): Promise<Contact[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Contact for case_id: ", caseId);

            const res = await db.raw(`
            SELECT name AS "contactName",
            phone AS "contactPhone",
            contact_type AS "contactType",
            email AS "contactEmail"
     FROM case_contacts
     WHERE case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `rawContactQuery~${caseId}`,
                result: res.rows
            }));
            return res.rows;

        } catch (e) {
            console.error("Contact query exception : ", e);
        }

        return [];
    }

    static async getRequestedService(caseId: uuid): Promise<RequestedService[][]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Requested Service for case_id: ", caseId);

            const res = await db.raw(`
            SELECT CL.type,
       A.unit_number AS "unitNumber",
       CL.requested_action AS "action",
       CL.tire_condition AS "condition",
       CL.tire_position AS "position",
       CL.axle_type AS "axle",
       CL.tire_size AS "tireSize",
       'TODO' AS "tireSizeType",
       CL.manufacturer_full_name AS "tireBrand",
       CL.sculpture_tread_name AS "treadDesign"
FROM case_lines CL LEFT JOIN assets A ON CL.asset_id = A.id
     WHERE CL.case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `requestedServiceQuery~${caseId}`,
                result: res.rows
            }));

            const requested = res.rows.filter((obj: RequestedService) => {
                return obj.type === 'request';
            });
            const agreed = res.rows.filter((obj: RequestedService) => {
                return obj.type === 'agreement';
            });
            const supplied = res.rows.filter((obj: RequestedService) => {
                return obj.type === 'supplied';
            });

            return [requested, agreed, supplied];

        } catch (e) {
            console.error("RequestedService query exception : ", e);
        }

        return [];
    }

    static async getServiceData(caseId: uuid): Promise<OutputServiceData[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Service Data for case_id: ", caseId);

            const res = await db.raw(`SELECT coalesce(D.st_name, CD.name) AS "servicingDealer",
            CONCAT(D.service_city, ' ', D.service_state) AS "servicingDealerStore",
            D.service_city AS "servicingDealerCity",
            D.service_state AS "servicingDealerState",
            D.country AS "servicingDealerCountry",
            D.service_zip AS "servicingDealerZip",
            D.service_address AS "servicingDealerAddress",
            D.ship_to AS "servicingDealerShipto",
            D.bill_to AS "servicingDealerBillto",
            DR.response_time AS "contactedTime",
            DR.phone_number AS "techPhone",
            DR.contact_person AS "techName",
            DRE.min_minutes AS "eta_min",
            DRE.max_minutes AS "eta_max",
            DR.asset_location_drive_distance AS "servicingDealerDriveDistance",
            DR.asset_location_drive_time AS "servicingDealerDriveTime",
            DR.reason AS "refusalAcceptedReason"
     FROM dealers_response DR
         LEFT JOIN dealers_response_etas DRE on DR.eta_id = dre.id
         LEFT JOIN dealers D ON DR.dealer_id = D.id
         LEFT JOIN custom_dealers CD ON DR.custom_dealer_id = CD.id
     WHERE DR.case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `serviceDataQuery~${caseId}`,
                result: res.rows
            }));

            const mapMainCase = (
                {
                    eta_min,
                    eta_max,
                    ...values
                }: InputServiceData): OutputServiceData => (
                {
                    etaDuration: {
                        min: eta_min,
                        max: eta_max

                    },
                    ...values
                })
            return res.rows.map((row: InputServiceData) => mapMainCase(row));

        } catch (e) {
            console.error("Service Data query exception : ", e);
        }

        return [];
    }

    static async getCaseNotes(caseId: uuid): Promise<CaseNote[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Case Notes for case_id: ", caseId);

            const res = await db.raw(`SELECT CN.body AS "notesText",
            CN.inserted_at AS "noteTimeStamp",
            U.user_name AS "userName"
     FROM case_notes CN
         LEFT JOIN users U ON CN.author_id = u.id
     WHERE case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `caseNotesQuery~${caseId}`,
                result: res.rows
            }));

            return res.rows;

        } catch (e) {
            console.error("Case Notes query exception : ", e);
        }

        return [];
    }

    static async getCaseStatusHistory(caseId: uuid): Promise<CaseStatusHistory[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Case Status History for case_id: ", caseId);

            const res = await db.raw(`SELECT 
                csc.timestamp AS "changeDate", 
                csc.old_status AS "oldStatus",
                csc.new_status AS "newStatus", 
                u.email AS "userEmail" 
                FROM case_status_changes csc JOIN users u ON (csc.user_id = u.id) 
                WHERE csc.case_id = '${caseId}'
                UNION 
                SELECT 
                c.inserted_at AS "changeDate",
                null AS "oldStatus",
                'new' AS "newStatus",
                u.email AS "userEmail"
                FROM cases c JOIN users u ON (c.created_by_id = u.id)
                WHERE c.id = '${caseId}'
                ORDER BY "changeDate" DESC;`);

            console.log(JSON.stringify({
                id: `caseStatusHistoryQuery~${caseId}`,
                result: res.rows
            }));

            return res.rows;

        } catch (e) {
            console.error("Case Status History query exception : ", e);
        }

        return [];
    }

    static async getLinkedCalls(caseId: uuid): Promise<LinkedCall[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Linked Call for case_id: ", caseId);

            const res = await db.raw(`SELECT direction AS "callType",
            start_time AS "callTimestamp",
            destination_number AS "phoneNumber",
            amazon_connect_contact_id AS "contactId",
            U.user_name AS "userName",
            destination_name AS "callTo"
     FROM case_calls LEFT JOIN users U on case_calls.user_id = U.id
     WHERE case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `linkedCallQuery~${caseId}`,
                result: res.rows
            }));

            return res.rows;

        } catch (e) {
            console.error("Linked Call query exception : ", e);
        }

        return [];
    }

    static async getNotifications(caseId: uuid): Promise<Notification[]> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Notification for case_id: ", caseId);

            const res = await db.raw(`SELECT inserted_at AS "sentTimestamp",
            case_email_type AS "notificationType",
            recipients_emails AS "emailAddress"
     FROM case_emails
     WHERE case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `notificationsQuery~${caseId}`,
                result: res.rows
            }));

            return res.rows;

        } catch (e) {
            console.error("Notification query exception : ", e);
        }

        return [];
    }

    static async getDelays(caseId: uuid): Promise<Delay[]> {
        const db = app.get('oncallDBClient');
        //caseId = 'aaf9d318-762d-44ec-9a30-c483f3817f71';

        try {
            console.log("Quering Delay for case_id: ", caseId);

            const res = await db.raw(`SELECT status,
            reason_type as "delayReason",
            start_time as "startTime",
            end_time as "endTime",
            custom_reason as "customReason"
     
     FROM delays
     WHERE case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `delaysQuery~${caseId}`,
                result: res.rows
            }));

            return res.rows;

        } catch (e) {
            console.error("Delay query exception : ", e);
        }

        return [];
    }

    static async getAsset(caseId: uuid): Promise<Asset> {
        const db = app.get('oncallDBClient');

        const units = {
            primaryUnitType: "",
            primaryUnitNumber: "",
            secondaryUnitType: "",
            secondaryUnitNumber: "",
        }

        try {
            console.log("Quering Asset for case_id: ", caseId);

            const res = await db.raw(`SELECT CASE WHEN case_id IS NOT NULL THEN 'primary' ELSE 'secondary' END AS "type",
            unit_number AS "unitNumber",
            asset_type AS "unitType"
     FROM assets
     WHERE case_id = '${caseId}' OR
           related_case_id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `AssetQuery~${caseId}`,
                result: res.rows
            }));

            res.rows.forEach(
                function (row: InputAsset) {
                    if (row.type === 'primary') {
                        units.primaryUnitType = row.unitType;
                        units.primaryUnitNumber = row.unitNumber;
                    } else {
                        units.secondaryUnitType = row.unitType;
                        units.secondaryUnitNumber = row.unitNumber;
                    }
                });
        } catch (e) {
            console.error("Asset query exception : ", e);
        }

        return units;
    }

    static async getCustomerPreference(caseId: uuid): Promise<CustomerPreferences> {
        const db = app.get('oncallDBClient');

        const noPreferences = {
            fleetContactsAvailable: false,
            driverAuthorized: false,
            poRequired: false,
            tirePreferences: false,
            wheelPreferences: false,
            emailPreferences: false,
        };

        try {
            console.log("Quering Customer Preference for case_id: ", caseId);

            const res = await db.raw(`SELECT CCP.preferences
            FROM cases C
                RIGHT JOIN case_customer_preferences CCP ON C.case_customer_preference_id = CCP.id
     WHERE C.id = '${caseId}';`);

            console.log(JSON.stringify({
                id: `customerPreferenceQuery~${caseId}`,
                result: res.rows
            }));
            const preferences = res.rows[0]?.preferences ?? false;

            return !!preferences ? {
                fleetContactsAvailable: !!preferences.contacts.length,
                driverAuthorized: preferences.service_preferences.driver_authorized,
                poRequired: preferences.billing_preferences.purchase_order_rule == 'required',
                tirePreferences: !!preferences.tire_preferences.length,
                wheelPreferences: !!preferences.wheel_preferences.length,
                emailPreferences: !!preferences.email_notification_preferences.length,
            }
                : noPreferences;

        } catch (e) {
            console.error("Customer Preference query exception : ", e);
        }

        return noPreferences;
    }

    // Throws when out of sync so the caller enqueues the case for retry.
    static async checkSyncDB(caseId: uuid, status: string | undefined): Promise<boolean> {
        const db = app.get('oncallDBClient');

        console.log(`Checking DB sync for case_id: ${caseId} and status: ${status}`);

        const where = [`case_id = '${caseId}'`];
        if (status) {
            where.push(`new_status = '${status}'`);
        }
        const res = await db.raw(`
            SELECT 1
            FROM case_status_changes
            WHERE ${where.join(' AND ')}
            LIMIT 1;`);

        console.log(JSON.stringify({
            id: `checkSyncDB~${caseId}`,
            result: res.rows
        }));

        if (res.rows.length > 0) {
            return true;
        }

        const error = new Error(`DB out of Sync for case ${caseId} and status ${status}`);
        error.name = 'DB_OUT_OF_SYNC';
        throw error;
    }

    static async getFixpixTimestamp(caseId: uuid): Promise<string> {
        const db = app.get('oncallDBClient');

        try {
            console.log("Quering Audit Logs for case_id: ", caseId);

            const res = await db.raw(`
            -- Fixpix timestamp in case that was sent to fixpix and was success or null in
            -- other case
            SELECT recorded_at AS "fixpix_sentTimestamp"
            FROM audit_logs
            WHERE
              case_id = '${caseId}'
              AND ENCODE(patch, 'escape') LIKE '%fixpix_push_result%'
              AND ENCODE(patch, 'escape') LIKE '%success%';`);

            console.log(JSON.stringify({
                id: `auditLogsQuery~${caseId}`,
                result: res.rows
            }));
            // If no rows, return empty
            return res.rows[0]?.fixpix_sentTimestamp ?? ""

        } catch (e) {
            console.error("Audit Logs query exception : ", e);
        }

        return "";
    }

    /**
     * Returns the originating integration identity if the case was digitally initiated,
     * or null if it was created by an Eagle agent.
     */
    static async getFlagDigitalInitiated(caseId: uuid): Promise<DigitalInitiatedInfo | null> {
        const db = app.get('oncallDBClient');
        try {
            const res = await db.raw(`
                SELECT u.email, u.user_name
                FROM cases c
                JOIN users u ON c.created_by_id = u.id
                WHERE c.id = '${caseId}'
                  AND u.api_token IS NOT NULL
                LIMIT 1;`);
            return res.rows[0] ?? null;
        } catch (e) {
            console.error('getFlagDigitalInitiated exception:', e);
            return null;
        }
    }

    /**
     * Returns true if ALL audit activity on the case came from API users or the MTVA system user,
     * indicating the case was fully auto-dispatched without human involvement.
     */
    static async getFlagAutoDispatch(caseId: uuid): Promise<boolean> {
        const db = app.get('oncallDBClient');
        const mtvaSystemUserEmail = DataSourceErs.getConfiguredMtvaSystemUserEmail();
        try {
            const res = await db.raw(`
                SELECT 1
                FROM cases c
                JOIN audit_logs al ON al.case_id = c.id
                JOIN users u ON u.id = al.actor_id
                WHERE c.id = '${caseId}'
                GROUP BY c.id
                HAVING COUNT(*) = COUNT(
                    CASE
                        WHEN u.api_token IS NOT NULL
                            OR u.email = '${mtvaSystemUserEmail}'
                        THEN 1 ELSE NULL
                    END
                )
                LIMIT 1;`);
            return res.rows.length > 0;
        } catch (e) {
            console.error('getFlagAutoDispatch exception:', e);
            return false;
        }
    }

    /**
     * Fetches the non-digital dispatch outcomes used by these three flags:
     * - timeOut
     * - dealerDecline
     * - noAnswer
     *
     * NOTE: case_autodispatch_timers is not fully available in CDL yet.
     */
    static async getDispatchOutcomeFlags(caseId: uuid): Promise<{ timeOut: boolean; dealerDecline: boolean; noAnswer: boolean }> {
        const db = app.get('oncallDBClient');
        try {
            const res = await db.raw(`
                SELECT
                    BOOL_OR(cat.timer_status = 'timed_out') AS "timeOut",
                    BOOL_OR(cat.timer_status = 'declined') AS "dealerDecline",
                    BOOL_OR(cat.timer_status = 'accepted' AND dr.reason = 'No answer') AS "noAnswer"
                FROM case_autodispatch_timers cat
                LEFT JOIN dealers_response dr ON cat.case_id = dr.case_id
                WHERE cat.case_id = '${caseId}';`);

            const row = res.rows[0] ?? {};
            return {
                timeOut: !!row.timeOut,
                dealerDecline: !!row.dealerDecline,
                noAnswer: !!row.noAnswer,
            };
        } catch (e) {
            console.error('getDispatchOutcomeFlags exception:', e);
            return {
                timeOut: false,
                dealerDecline: false,
                noAnswer: false,
            };
        }
    }

    /**
     * Resolves all ONCall flags for a case.
     * Independent flags are fetched in parallel; derived flags are computed as conditions
     * once the query-based results are available.
     */
    static async getCaseFlags(caseId: uuid, mainCase: PartialOutputMainCase, inboundProgramNumberId?: number | null): Promise<CaseFlags> {
        const locationValidatedByDriver = !!mainCase.locationValidatedByDriver;
        const duplicateEvents = mainCase.duplicateEvents ?? null;
        const cancelledBillable = !!mainCase.cancelledBillable;

        const [
            digitalInitiated,
            autoDispatch,
            dispatchOutcome,
        ] = await Promise.all([
            DataSourceErs.getFlagDigitalInitiated(caseId),
            DataSourceErs.getFlagAutoDispatch(caseId),
            DataSourceErs.getDispatchOutcomeFlags(caseId),
        ]);

        const { timeOut, dealerDecline, noAnswer } = dispatchOutcome;

        const noFailureConditions = !timeOut && !dealerDecline && !noAnswer;
        const dealerRollOver = await DataSourceErs.getFlagDealerRollOver(inboundProgramNumberId);

        const flags: CaseFlags = {
            digitalInitiated,
            autoDispatch,
            timeOut,
            dealerDecline,
            noAnswer,
            // True when auto-dispatch ran and no failure conditions occurred
            fullSuccessDigitalEvent: autoDispatch && noFailureConditions,
            // Inverse of autoDispatch: a human touched the case
            notUsed: !autoDispatch,
            // Requires both digital initiation AND a clean auto-dispatch
            fullyDigitalEvent: digitalInitiated !== null && autoDispatch && noFailureConditions,
            dealerRollOver,
            haasAlert: locationValidatedByDriver,
            duplicateEvents,
            cancelledBillable,
        };

        return flags;
    }

    static async getOnCallCase(onCallCase: OnCallNewCase): Promise<OutputMainCase> {

        //onCallCase.id = '8e40b713-cc3c-479a-a45a-f8c6b8952396';

        await DataSourceErs.checkSyncDB(onCallCase.id, onCallCase.status);

        const mainCaseResultPromise = DataSourceErs.getMainCase(onCallCase.id, onCallCase.status);
        const flagsPromise = mainCaseResultPromise.then(({ mainCase }) => DataSourceErs.getCaseFlags(onCallCase.id, mainCase, onCallCase.inbound_program_number_id));

        const [mainCaseResult, contacts, serviceData, [requestedService, agreedService, suppliedService], caseNotes, linkedCalls, notifications, asset, customerProfile, delays, caseStatusHistory, flags] = await Promise.all([
            mainCaseResultPromise,
            DataSourceErs.getContacts(onCallCase.id),
            DataSourceErs.getServiceData(onCallCase.id),
            DataSourceErs.getRequestedService(onCallCase.id),
            DataSourceErs.getCaseNotes(onCallCase.id),
            DataSourceErs.getLinkedCalls(onCallCase.id),
            DataSourceErs.getNotifications(onCallCase.id),
            DataSourceErs.getAsset(onCallCase.id),
            DataSourceErs.getCustomerPreference(onCallCase.id),
            DataSourceErs.getDelays(onCallCase.id),
            DataSourceErs.getCaseStatusHistory(onCallCase.id),
            flagsPromise,
        ]);

        const { mainCase } = mainCaseResult;

        const oncallCase: OutputMainCase = {
            ...mainCase,
            contacts,
            serviceData,
            requestedService,
            agreedService,
            suppliedService,
            caseNotes,
            linkedCalls,
            notifications,
            ...asset,
            customerProfile,
            delays,
            caseStatusHistory,
            flags,
        }

        console.log("Finish sanitizing case...");
        return oncallCase;
    }
}