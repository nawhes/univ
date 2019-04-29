/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Contract, Context } = require('fabric-contract-api');
const ClientIdentity = require('fabric-shim').ClientIdentity;
const shim = require('fabric-shim');

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

    async create(ctx, email, pin, date) {
        let account = await ctx.accountList.getAccount(email);
        if (account == null){
            account = await Account.createInstance(email, pin, date);
            await ctx.accountList.addAccount(account);
            return shim.success(State.serialize(account).toString('ascii'));
        }
        return "err: This account was previously created.";
    }

    async query(ctx, email, pin, channel){
        let account = await ctx.accountList.getAccount(email);
        if (account == null){
            return "err: This account does not exist.";
        }
        let length = arguments.length;
        if (length == 2){
            return shim.success(State.serialize(account).toString('ascii'));
        } else if (Account.validationPin(account.digest, account.salt_record, pin)){
            let temp = await invokeChaincode(channel, new Array("query", email, pin), channel);
            console.log("#################");
            console.log(typeof temp);
            console.log(temp.toString());
            if (typeof temp == "String"){
                if (temp.substring(0,2) == "err"){
                    return "err: Hmm.."
                }
            }
            let response = State.deserialize(temp);
            console.log("#################");
            console.log(typeof response);
            console.log(response.toString());

            return shim.success(State.serialize(response.payload).toString('ascii'));
        } else {
            return "err: This pin is invalid.";
        }
    }

    async queryKey(ctx, email, pin, channel) {
        let account = await ctx.accountList.getAccount(email);
        if (account == null){
            return "err: This account does not exist.";
        }
        let recordKey;
        if (Account.validationPin(account.digest, account.salt_record, pin)){
            recordKey = Account.getRecordKey(account.salt_record, channel, pin);
        } else {
            return "err: This pin is invalid";
        }
        return shim.success(Buffer.from(recordKey.toString()).toString('ascii'));
    }

    async delete(ctx, email, pin, channel) {//미완성
        let account = await ctx.accountList.getAccount(email);
        if (account == null){
            return "err: This account does not exist.";
        }
        let recordKey;
        if (Account.validationPin(account.digest, account.salt_record, pin)){
            recordKey = Account.getRecordKey(account.salt_record, channel, pin);
        } else {
            return "err: This pin is invalid.";
        }
        //request to delete career
        ctx.accountList.deleteAccount(account);
    }
}

module.exports = AccountContract;
