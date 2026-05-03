import type { ApiResponseContract } from '../common/api-response.contract.js';
import type { ErrorResponseContract } from '../common/error-response.contract.js';
import type { UserContract } from './user.contract.js';

export type UsersListResponseContract = ApiResponseContract<UserContract[]>;
export type UserMutationResponseContract = ApiResponseContract<UserContract>;
export type UserByIdResponseContract = ApiResponseContract<UserContract> | ErrorResponseContract;
export type UserDeleteResponseContract =
  | ApiResponseContract<{
      id: string;
    }>
  | ErrorResponseContract;