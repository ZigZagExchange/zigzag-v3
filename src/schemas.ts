// SPDX-License-Identifier: BUSL-1.1
import Joi from 'joi'

const now = (Date.now() / 1000) | 0
export const EVMOrderSchema = Joi.object({
  user: Joi.string().required().messages({
    'string.base': `"user" should be a type of 'string'`,
    'string.hex': `"user" should be a hex string`,
    'any.required': `"user" is a required field`,
  }),
  sellToken: Joi.string().required().messages({
    'string.base': `"sellToken" should be a type of 'string'`,
    'string.hex': `"sellToken" should be a hex string`,
    'any.required': `"sellToken" is a required field`,
  }),
  buyToken: Joi.string().required().messages({
    'string.base': `"buyToken" should be a type of 'string'`,
    'string.hex': `"buyToken" should be a hex string`,
    'any.required': `"buyToken" is a required field`,
  }),
  sellAmount: Joi.string().required().messages({
    'string.base': `"sellAmount" should be a type of 'string'`,
    'any.required': `"sellAmount" is a required field`,
  }),
  buyAmount: Joi.string().required().messages({
    'string.base': `"buyAmount" should be a type of 'string'`,
    'any.required': `"buyAmount" is a required field`,
  }),
  expirationTimeSeconds: Joi.number()
    .greater(now)
    .less(now * 2)
    .required()
    .messages({
      'number.base': `"expirationTimeSeconds" should be a type of 'integer'`,
      'any.required': `"expirationTimeSeconds" is a required field`,
    }),
})
