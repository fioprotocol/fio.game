const { FIOSDK } = require('@fioprotocol/fiosdk');
import fetch from 'cross-fetch';
import config from '../utils/config';
import { logger_info, logger_error } from '../utils/logger';

interface FioSdkInstance {
    genericAction(action: string, params: any): Promise<any>;
}

interface FioSdkStatic {
    new (
        privateKey: string,
        publicKey: string,
        baseUrl: string,
        fetchJson: (uri: string, opts?: any) => Promise<any>
    ): FioSdkInstance;
    derivedPublicKey(privateKey: string): { publicKey: string };
    accountHash(publicKey: string): { accountnm: string };
}

export interface ProcessedFioRequest {
    fio_request_id: number;
    payer_fio_address: string;
    payee_fio_address: string;
    payee_public_address: string;
    amount: string;
    memo: string;
}

const FioSdkTyped = FIOSDK as FioSdkStatic;

// FIO SDK instance
function getFioSdkInstance(): FioSdkInstance {
    const fetchJson = async (uri: string, opts = {}) => {
        return fetch(uri, opts);
    }
    const privateKey = config.FIO_PRIVATE_KEY;
    const publicKey = FioSdkTyped.derivedPublicKey(privateKey).publicKey;
    return new FioSdkTyped(privateKey, publicKey, config.FIO_API_URL, fetchJson);
}

// Fetches FIO Requests from FIO Chain
export async function getPendingFioRequests(): Promise<ProcessedFioRequest[]> {
    const fioSdk = getFioSdkInstance();
    try {
        const result = await fioSdk.genericAction('getPendingFioRequests', {
            limit: config.FIO_REQ_LIMIT,
            offset: 0
        });
        return result.requests.map((request: any) => ({
            fio_request_id: request.fio_request_id,
            payer_fio_address: request.payer_fio_address,
            payee_fio_address: request.payee_fio_address,
            payee_public_address: request.content.payee_public_address,
            amount: request.content.amount,
            memo: request.content.memo
        }));
    } catch (error: any) {
        if (error?.code === 404) {
            return [];
        }
        logger_error('FIO_SERVICE', 'Failed to get pending FIO requests', error);
        throw error;
    }
}

// Rejects FIO Request after guess
export async function rejectFioRequest(fioRequestId: number): Promise<void> {
    const fioSdk = getFioSdkInstance();
    try {
        const result = await fioSdk.genericAction('rejectFundsRequest', {
            fioRequestId,
            maxFee: config.FIO_MAX_FEE,
            technologyProviderId: config.FIO_TPID
        });

        if (!result?.status || result.status !== 'request_rejected') {
            throw new Error('Failed to reject FIO request due to unexpected result.');
        }
    } catch (error) {
        logger_error('FIO_SERVICE', `Failed to reject FIO request ${fioRequestId}`, error);
        throw error;
    }
}

// Sends reward to winner
export async function sendReward(
    winnerPublicKey: string,
    winnerFioAddress: string,
    fioRequestId: number,
    amount: number
): Promise<void> {
    const fioSdk = getFioSdkInstance();
    const publicKey = FIOSDK.derivedPublicKey(config.FIO_PRIVATE_KEY).publicKey;
    const account = FIOSDK.accountHash(publicKey).accountnm;

    try {
        // Step 1: Send the reward
        const transferActionData = {
            payee_public_key: winnerPublicKey,
            amount: amount,
            max_fee: config.FIO_MAX_FEE,
            tpid: config.FIO_TPID,
            actor: account
        };

        const rewardResult = await fioSdk.genericAction('pushTransaction', {
            action: 'trnsfiopubky',
            account: 'fio.token',
            data: transferActionData
        });

        if (!rewardResult?.transaction_id) {
            throw new Error('Failed to send reward - no transaction ID received');
        } else {
            logger_info('FIO_SERVICE', `Successfully sent reward to ${winnerPublicKey} in tx ${rewardResult.transaction_id}`);
        }

        // Step 2: Record OBT data with a unique obtId
        const RecordObtActionData = {
            fioRequestId: fioRequestId.toString(),
            payerFioAddress: config.FIO_GUESS_HANDLE,
            payeeFioAddress: winnerFioAddress,
            payeeTokenPublicAddress: winnerPublicKey,
            amount: amount,
            chainCode: 'FIO',
            tokenCode: 'FIO',
            status: 'sent_to_blockchain',
            obtId: rewardResult.transaction_id,
            memo: 'Congratulations on winning the FIO Request Game',
            maxFee: config.FIO_MAX_FEE,
            payeeFioPublicKey: winnerPublicKey
        };

        const obtResult = await fioSdk.genericAction('recordObtData', RecordObtActionData);

        if (!obtResult?.transaction_id) {
            throw new Error('Failed to record obt - no transaction ID received');
        } else {
            logger_info('FIO_SERVICE', `Successfully recorded obt in tx ${obtResult.transaction_id}`);
        }

    } catch (error) {
        throw new Error(`Failed to send reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Get FIO token balance
export async function getFioBalance(): Promise<number> {
    try {
        const response = await fetch(`${config.FIO_API_URL}chain/get_fio_balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fio_public_key: config.FIO_PUBLIC_KEY
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to get FIO balance: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.available / 1000000000;
    } catch (error) {
        logger_error('FIO_SERVICE', 'Failed to get FIO balance', error);
        throw error;
    }
}