import type { FnaCaseRecord } from '../services/mechanical-email';

export interface DMSMessage {
  data: OnCallNewCase | OnCallUpdateCase | FnaCaseRecord;
  metadata: DocumentsMetadata;
}

export interface OnCallNewCase {
  id: string;
  case_number: string;
  inserted_at?: string;
  updated_at?: string;
  status?: string;
  created_by_id?: string;
  fixpix_push_result?: string;
  billable?: string;
  electronic_service_request?: string;
  updated_case_data?: string;
  use_asset_coordinates_for_travel_estimation?: string;
  has_failed_automated_call?: string;
  asset_location_coordinates?: string;
  asset_location_highway?: string;
  asset_location_mile_marker?: string;
  asset_location_note?: string;
  customer_id?: string;
  billing_reference_number?: string;
  payment_method?: string;
  inbound_program_number_id?: number;
  asset_location_search_value?: string;
  special_instructions?: string;
  customer_bill_to?: string;
  customer_ship_to?: string;
  customer_name?: string;
  customer_type?: string;
  cancel_reason?: string;
  asset_location_country_code?: string;
  inbound_program_name?: string;
  servicing_dealer_id?: string;
  quick_note?: string;
  dealer_name?: string;
  asset_location_country?: string;
  asset_location_city?: string;
  asset_location_province?: string;
  inbound_program_phone_number?: string;
  data_house_push_time?: string;
  primary_asset_unit_number?: string;
  dealer_city?: string;
  dealer_state?: string;
  dispatched_time?: string;
  proximity_level?: string;
}

export interface OnCallUpdateCase extends OnCallNewCase {
  previous_id: string;
  previous_case_number: string;
  previous_inserted_at: string;
  previous_updated_at: string;
  previous_status: string;
  previous_assigned_to_id: string;
  previous_created_by_id: string;
  previous_fixpix_push_result: string;
  previous_billable: string;
  previous_electronic_service_request: string;
  previous_updated_case_data: string;
  previous_use_asset_coordinates_for_travel_estimation: string;
  previous_has_failed_automated_call: string;
}

export interface DocumentsMetadata {
  timestamp: string;
  "record-type": string;
  operation: string;
  "partition-key-type": string;
  "schema-name": string;
  "table-name": string;
  "transaction-id": number;
}

export interface RetryCaseData {
  id: string;
  case_number: string;
  status?: string;
  nextRetry: string;
  retryNumber: number;
  caseData: OnCallNewCase | OnCallUpdateCase | FnaCaseRecord;
}
