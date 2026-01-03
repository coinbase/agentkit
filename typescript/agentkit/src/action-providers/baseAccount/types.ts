// Base Account spend permission types
export interface PermissionData {
  account?: string;
  spender?: string;
  token?: string;
  allowance?: bigint | string;
  period?: number;
  start?: number;
  end?: number;
}

export interface FetchedPermission {
  permissionHash?: string;
  signature?: string;
  chainId?: number;
  createdAt?: number;
  permission?: PermissionData;
  allowance?: bigint | string;
}
