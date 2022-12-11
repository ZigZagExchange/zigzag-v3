import type {
  ZZHttpServer,
} from '../types'
import { sendErrorMsg } from './helpers';

export default function marketRoutes(app: ZZHttpServer) {

  app.get('/v1/markets', async (req, res) => {
  })

}
