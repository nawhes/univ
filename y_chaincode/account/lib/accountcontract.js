/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Contract, Context } = require('fabric-contract-api');
const shim = require('fabric-shim');

const bcrypt = require('bcrypt');
const Account = require('./account.js');
const AccountList = require('./accountlist.js');

const channelName = "account";


class AccountContext extends Context {
    constructor() {
        super();
        this.accountList = new AccountList(this);
    }
}

class AccountContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super(channelName);
    }

    createContext() {
        //Define a custom context
        return new AccountContext();
    }

    /**
     * Instantiate to perform any setup of the ledger that might be required.
     * @param {Context} ctx the transaction context
     */
    async instantiate(ctx) {
        // It could be where data migration is performed, if necessary
        console.log('Instantiate the contract');
    }

    /**
     * 계정생성 > return 계정정보
     */
    async create(ctx, email, digest) {
        if (arguments.length != 3) {
            return shim.error("err: Three parameters are required.");
        }
        let account = await ctx.accountList.getAccount(email); 
        if (account == null) {
            account = await Account.createInstance(email, Date(), digest);
            account.txid.push(ctx.stub.getTxID());
            await ctx.accountList.addAccount(account);
            return shim.success(Account.serialize(account).toString('ascii'));
        }
        return shim.error("err: This account was previously created.");
    }

    /**
     * (email, pin) > return 계정정보
     * (email, pin, channel, issuer) > return 이력정보
     */
    async query(ctx, email, pin, channel, issuer) {
        if (arguments.length < 3) {
            return shim.error("At least three parameters are required.");
        }
        let account = await ctx.accountList.getAccount(email);
        if (account == null) {
            return shim.error("err: This account does not exist.");
        }
        // if (true) {
        if (bcrypt.compareSync(pin, account.digest)) {
            if (arguments.length == 3) {
                return shim.success(Account.serialize(account).toString('ascii'));
            }

            let recordKey = await Account.getRecordKey(email, issuer);
            recordKey = recordKey.toString('hex');
            let temp = await ctx.stub.invokeChaincode(channel, new Array("queryByKey", recordKey), channel);
            temp = temp.payload;
            let response = temp.buffer.toString('ascii', temp.offset, temp.limit);

            response = JSON.parse(response);

            if (response.status == 500) {
                return shim.error("InvokeChaincode was returned 500. >> " + response.message);
            }

            return shim.success(Account.serialize(response.payload).toString('ascii'));
        } else {
            return shim.error("err: This pin is invalid.");
        }
    }

    /**
     * 각 채널에서 이력입력을 위해 사용하는 함수
     */
    async queryKey(ctx, email, pin, issuer) {
        if (arguments.length != 4) {
            return shim.error("err: Four parameters are required.");
        }
        let account = await ctx.accountList.getAccount(email);
        if (account == null) {
            return shim.error("err: This account does not exist.");
        }
        let recordKey;
        // if (true) {
        if (bcrypt.compareSync(pin, account.digest)) {
            recordKey = await Account.getRecordKey(email, issuer);
            recordKey = recordKey.toString('hex');
            return shim.success(Buffer.from(recordKey.toString()).toString('ascii'));
        }
        return shim.error("err: This pin is invalid");
    }

    async update(ctx, email, pin, channel, issuer) {
        let account = await ctx.accountList.getAccount(email);
        if (account == null) {
            return shim.error("err: This account does not exist.");
        // } else if (true) {
        } else if (bcrypt.compareSync(pin, account.digest)) {
            if (!account[channel]) {
                account[channel] = [];
            }
            if (account[channel].indexOf(issuer) == -1){
                account[channel].push(issuer);
            }
            account.txid.push(ctx.stub.getTxID());
            await ctx.accountList.addAccount(account);
            return shim.success(Account.serialize(account).toString('ascii'));
        }
        return shim.error("err: This pin is invalid");
    }

    async delete(ctx, email, pin, issuer) {//미완성
        let account = await ctx.accountList.getAccount(email);
        if (account == null) {
            return shim.error("err: This account does not exist.");
        }
        let recordKey;
        if (bcrypt.compareSync(pin, account.digest)) {
            recordKey = await Account.getRecordKey(email, issuer);
            recordKey = recordKey.toString('hex');
            //request to delete career
            ctx.accountList.deleteAccount(account);
        } else {
            return shim.error("err: This pin is invalid.");
        }
    }
}

module.exports = AccountContract;
