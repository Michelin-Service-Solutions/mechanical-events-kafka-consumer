import type { Application } from "../declarations";

interface MispApp {
    id: number;
    name: string;
    token: string;
    url: string;
    permissions: {
        [key: string]: any;
    };
    active: boolean;
    sequence: string;
    icon: string;
    reach: "backend" | "frontend";
    app_key: string;
    features: {
        [key: string]: boolean;
    };
}
export interface Role {
    id: number;
    name: string;
    full_name: string;
    permissions: Permissions;
    misp_app: MispApp;
    blocked: boolean;
    role_type: string;
    rule: any;
}
export interface Account {
    home_office_name: string;
    cust_chl_desc: string;
    extract_time: string;
    cust_bus_desc: string;
    customer_country: string;
    gsi1_range_key: string;
    action_code: string;
    team_id: string;
    cust_categ_code: string;
    glo_code_desc: string;
    dr_wheel_postn_req: string;
    gsi1_hash_key: string;
    home_office_number: string;
    customer_city: string;
    ers_allowed_ind: string;
    parent_company_name: string | null;
    cust_sub_chnl_code: string;
    fips_county: string;
    cust_categ_desc: string;
    allow_bfgoodrich_tires: boolean;
    update_date: string;
    customer_addr1: string;
    gsi2_hash_key: string;
    tread_depth_remain_32_req: string;
    customer_county: string;
    allow_megamile_tires: boolean;
    cust_chnl_code: string;
    tire_disposition_code_req: string;
    allow_michelin_tires: boolean;
    org_id: string;
    phone_number: string;
    allow_mrt_tires: boolean;
    create_user: string;
    customer_type: string;
    gsi3_hash_key: string;
    customer_number: string;
    cust_extrnl_bus_reln_desc: string;
    gsi3_range_key: string;
    allow_uniroyal_tires: boolean;
    extrnl_cust_id: string;
    customer_addr2: string | null;
    update_user: string;
    customer_dba_name: string | null;
    dealer_flag: boolean;
    is_valid_physical_address: boolean;
    dr_removal_rsn_req: string;
    relationship: string;
    ship_to_customer_name: string;
    plt_category_name: string;
    address: string;
    is_active: boolean;
    cust_extrnl_bus_reln_code: string;
    customer_state: string;
    added_date: string;
    range_key: string;
    bill_to_customer_name: string;
    parent_company_number: string | null;
    current_version: number;
    gsi2_range_key: string;
    extract_date: string;
    phone_cntry_code: string;
    record_type: string;
    cust_bus_code: string;
    customer_zip: string;
    glo_code: string;
    bill_to_customer: string;
    email_address: string | null;
    hold_code: string | null;
    sales_agreement_codes: string[];
    fips_state: string;
    hash_key: string;
    allow_oliver_tires: boolean;
    billing_child_last_update_date: string;
    cust_sub_chnl_desc: string;
    created_date: string;
    customer_name: string;
    hold_code_date: string | null;
    ship_to_customer: string;
    search_customer_name: string;
    is_commercial: boolean;
    is_urban: boolean;
    secondaryTransportActivity: string;
    primaryVocation: string;
    secondaryVocation: string;
    primaryTransportActivity: string;
    gsi5_range_key: string;
    gsi5_hash_key: string;
    cust_timezone: string;
    fips_county_desc: string;
    searchable_name: string;
}
export interface Grant {
    id: number;
    locations: Location[];
    location_group_id: number;
    role_id: number;
    grant_type: string;
    roles: Role[];
    role: Role;
    accounts: Account[];
    grant_location_type: string;
}
export interface Profile {
    first_name: string;
    last_name: string;
    language: string;
    timezone: string;
}
export interface UserProfile {
    id: string;
    email: string;
    active: boolean;
    channels: string[];
    uid: string;
    applications: Application[];
    grant_ids: number[];
    master_role: string;
    username: string;
    grants: Grant[];
    profile: Profile;
    change_password: boolean;
    welcome_screen: boolean;
}

export const centralHelperPath = "centralHelper";

declare module "../declarations" {
    interface Configuration {
        [centralHelperPath]: CentralHelper;
    }
}

class CentralHelper {
    private baseUrl = "";
    private token = "";
    private app: Application;

    constructor(baseUrl: string, token: string, app: Application) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.app = app;
    }

    public async getCurrentUserProfileData(
        token: string
    ): Promise<UserProfile | null> {
        try {
            const res = await fetch(
                `${this.baseUrl}/users/profile?simplified=true`,
                {
                    method: "get",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const profile: UserProfile = await res.json();
            console.log("PROFILE", profile);
            await this.auditResult(
                res.url,
                token,
                JSON.stringify(res.headers),
                JSON.stringify(profile)
            );
            if (res.ok) {
                return profile;
            }
        } catch (error) {
            console.log("ERROR", error);
            await this.auditError(
                `${this.baseUrl}/users/profile`,
                token,
                error.stack
            );
        }

        return null;
    }

    public async getApplicationData(appToken: string): Promise<MispApp | null> {
        try {
            const res = await fetch(`${this.baseUrl}/misp_apps/${appToken}`, {
                method: "get",
                headers: {
                    Authorization: `x-auth ${this.token}`,
                    "Content-Type": "application/json",
                },
            });

            const profile = await res.json();
            console.log("PROFILE app", profile);
            await this.auditResult(
                res.url,
                this.token,
                JSON.stringify(res.headers),
                JSON.stringify(profile)
            );

            if (res.ok) {
                return profile.misp_app;
            }
        } catch (error) {
            console.log("ERROR", error);
            await this.auditError(
                `${this.baseUrl}/misp_apps/${appToken}`,
                appToken,
                error.stack
            );
        }

        return null;
    }

    public async isFeatureFlagEnabled(flag: string): Promise<boolean> {
        try {
            const featureFlags = (await this.getApplicationData(this.token))
                ?.features;
            return !!featureFlags && featureFlags[flag] === true;
        } catch (error) {
            console.log("ERROR", error);
            return false;
        }
    }

    public async getUser(userId: string): Promise<UserProfile | null> {
        try {
            const res = await fetch(`${this.baseUrl}/users/${userId}`, {
                method: "get",
                headers: {
                    Authorization: `x-auth ${this.token}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await res.json();
            await this.auditResult(
                res.url,
                userId,
                JSON.stringify(res.headers),
                JSON.stringify(result)
            );

            if (res.ok) {
                return result.user;
            }
        } catch (error) {
            console.log("ERROR", error);
            await this.auditError(
                `${this.baseUrl}/users/${userId}`,
                userId,
                error.stack
            );
        }

        return null;
    }

    protected async auditError(
        url: string,
        identifier: string,
        error: string
    ): Promise<void> {

    }

    protected async auditResult(
        url: string,
        identifier: string,
        request: string,
        result: string
    ): Promise<void> {

    }
}

export const CentralService = (app: Application) => {
    const host = app.get("centralHost");
    const token = app.get("appToken");
    const centralHelper = new CentralHelper(host, token, app);
    app.set(centralHelperPath, centralHelper);
};
