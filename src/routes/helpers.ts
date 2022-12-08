import type {
  zzErrorMessage
} from '../types'

/* helper functions */
export const sendErrorMsg = (res: any, msg: string) => {
  const errorMsg: zzErrorMessage = {
    op: 'error',
    args: msg
  }
  res.status(400).json(errorMsg)
}

export const doesNotExist = (res: any, value: any, name: string) => {
  if (!value) {
    sendErrorMsg(res, `Missing ${name}`)
    return true
  }
  return false
}
