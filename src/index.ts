import expressApp from "./app"
import throng from 'throng'

function start() {
  const port = Number(process.env.PORT) || 3004
  expressApp.listen(port, () => {
    console.log(`Server listening on port ${port}.`)
  })
}

const WORKERS = process.env.WEB_CONCURRENCY ? Number(process.env.WEB_CONCURRENCY) : 1
throng({
  worker: start,
  count: WORKERS,
  lifetime: Infinity,
})

