import { Link } from 'react-router'

import { useEventTypes } from '@/api/queries'
import { QueryError } from '@/components/query-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function EventTypesPage() {
  const query = useEventTypes()

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />
  }

  const eventTypes = query.data

  if (eventTypes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Пока нет доступных видов записи. Загляните позже.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Выберите вид встречи</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {eventTypes.map((eventType) => (
          <Card key={eventType.id}>
            <CardHeader>
              <CardTitle>{eventType.title}</CardTitle>
              <CardAction>
                <Badge variant="secondary">{eventType.durationMinutes} мин</Badge>
              </CardAction>
              <CardDescription>{eventType.description}</CardDescription>
            </CardHeader>
            <CardContent />
            <CardFooter>
              <Button render={<Link to={`/book/${eventType.id}`} />}>Выбрать время</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
