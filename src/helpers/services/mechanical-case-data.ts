import type { Application } from '../../declarations';
import type { FnaCaseRecord } from './mechanical-email';

export const mechanicalCaseDataPath = 'mechanicalCaseData';

declare module '../../declarations' {
  interface Configuration {
    [mechanicalCaseDataPath]: MechanicalCaseData;
  }
}

export class MechanicalCaseData {
  constructor(private readonly app: Application) {}

  async get(record: FnaCaseRecord): Promise<FnaCaseRecord> {
    const db = this.app.get('oncallDBClient');
    const result = await db.raw(`
      SELECT c.case_number AS "EventNumber",
             c.customer_name AS "CustomerName",
             c.billing_po_number AS "CustomerPoNumber",
              COALESCE(c.asset_location_street_address, c.asset_location_search_value) AS "Event_Address",
              c.asset_location_city AS "Event_City",
              c.asset_location_province AS "Event_State",
              c.asset_location_country AS "Event_Country",
             c.primary_asset_unit_number AS "Unit",
             c.customer_ship_to AS "ShipTo",
             c.customer_bill_to AS "BillTo",
             c.dealer_name AS "ServiceProvider",
             c.rolling_at AS "WorkCompleteDate",
             cc.name AS "Driver",
             cc.phone AS "DriverPhone",
              c.special_instructions AS "Complaint",
             cl.requested_action AS "ServiceType",
             cl.tire_position AS "TirePosition",
             cl.tire_condition AS "FailureReason",
             a.asset_type AS "EquipmentType"
      FROM cases c
      LEFT JOIN case_contacts cc ON cc.case_id = c.id AND cc.contact_type = 'driver_cell'
      LEFT JOIN case_lines cl ON cl.case_id = c.id AND cl.type = 'supplied'
      LEFT JOIN assets a ON a.case_id = c.id
      WHERE c.id::text = ? OR c.case_number = ?
      LIMIT 1`, [record.id ?? null, record.EventNumber ?? record.case_number ?? null]);

    return { ...(result.rows[0] ?? {}), ...record };
  }
}

export const mechanicalCaseData = (app: Application): void => {
  app.set(mechanicalCaseDataPath, new MechanicalCaseData(app));
};
