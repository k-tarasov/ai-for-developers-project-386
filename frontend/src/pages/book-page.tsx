import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import { queryKeys, useCreateBooking, useEventType, useSlots } from '@/api/queries'
import type { Booking, Slot } from '@/api/queries'
import { QueryError } from '@/components/query-error'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatUtcDate, formatUtcDateTime, formatUtcTime, groupSlotsByDay } from '@/lib/datetime'

const bookingFormSchema = z
  .object({
    guestName: z.string().min(1, 'Укажите имя'),
    guestPhone: z.string(),
    guestEmail: z.string(),
    guestComment: z.string(),
  })
  .superRefine((values, ctx) => {
    const hasPhone = values.guestPhone.trim().length > 0
    const hasEmail = values.guestEmail.trim().length > 0
    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guestPhone'],
        message: 'Укажите хотя бы один контакт: телефон или email',
      })
      return
    }
    if (hasEmail && !z.string().email().safeParse(values.guestEmail.trim()).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guestEmail'],
        message: 'Некорректный email',
      })
    }
  })

type BookingFormValues = z.infer<typeof bookingFormSchema>

function Confirmation({ booking, onReset }: { booking: Booking; onReset: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Вы записаны</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="font-medium">{booking.eventType.title}</span> (
          {booking.eventType.durationMinutes} мин)
        </p>
        <p>
          {formatUtcDateTime(booking.startsAt)} – {formatUtcTime(booking.endsAt)} UTC
        </p>
        <p className="text-muted-foreground">Гость: {booking.guestName}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onReset}>
            Записать ещё
          </Button>
          <Button variant="ghost" render={<Link to="/" />}>
            К списку видов встреч
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function BookPage() {
  const { eventTypeId = '' } = useParams()
  const eventTypeQuery = useEventType(eventTypeId)
  const slotsQuery = useSlots(eventTypeId)
  const createBooking = useCreateBooking()
  const queryClient = useQueryClient()

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [created, setCreated] = useState<Booking | null>(null)

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { guestName: '', guestPhone: '', guestEmail: '', guestComment: '' },
  })

  const isNotFound =
    (eventTypeQuery.error instanceof ApiError && eventTypeQuery.error.code === 'EVENT_TYPE_NOT_FOUND') ||
    (slotsQuery.error instanceof ApiError && slotsQuery.error.code === 'EVENT_TYPE_NOT_FOUND')

  if (isNotFound) {
    return (
      <Alert>
        <AlertTitle>Тип события недоступен</AlertTitle>
        <AlertDescription>
          Такой вид встречи не найден или больше не принимает запись.{' '}
          <Link to="/" className="underline">
            Вернуться к списку видов встреч
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  if (eventTypeQuery.isPending || slotsQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (eventTypeQuery.isError) {
    return <QueryError error={eventTypeQuery.error} onRetry={() => void eventTypeQuery.refetch()} />
  }

  if (slotsQuery.isError) {
    return <QueryError error={slotsQuery.error} onRetry={() => void slotsQuery.refetch()} />
  }

  const eventType = eventTypeQuery.data
  const { slots, windowStartsOn, windowEndsOn } = slotsQuery.data

  if (created) {
    return <Confirmation booking={created} onReset={() => { setCreated(null); setSelectedSlot(null); form.reset(); createBooking.reset() }} />
  }

  function handleSubmit(values: BookingFormValues) {
    if (!selectedSlot) return
    createBooking.mutate(
      {
        eventTypeId,
        startsAt: selectedSlot.startsAt,
        guestName: values.guestName.trim(),
        guestPhone: values.guestPhone.trim() || undefined,
        guestEmail: values.guestEmail.trim() || undefined,
        guestComment: values.guestComment.trim() || undefined,
      },
      {
        onSuccess: (booking) => setCreated(booking),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'SLOT_BUSY') {
            setSelectedSlot(null)
            void queryClient.invalidateQueries({ queryKey: queryKeys.slots(eventTypeId) })
          }
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{eventType.title}</h1>
        <p className="text-muted-foreground">
          {eventType.durationMinutes} мин · Окно записи: {windowStartsOn} – {windowEndsOn} (UTC)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Свободное время (UTC)</h2>
        {slots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            В ближайшие 14 дней свободного времени нет.
          </div>
        ) : (
          <div className="space-y-4">
            {groupSlotsByDay(slots).map(([day, daySlots]) => (
              <div key={day}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {formatUtcDate(daySlots[0].startsAt)}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      variant={selectedSlot?.startsAt === slot.startsAt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatUtcTime(slot.startsAt)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {slots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Ваши данные</h2>
          {createBooking.isError && (
            <Alert variant="destructive">
              <AlertTitle>Не удалось создать запись</AlertTitle>
              <AlertDescription>{errorMessage(createBooking.error)}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="max-w-md space-y-4">
              <FormField
                control={form.control}
                name="guestName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestComment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Комментарий (необязательно)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={!selectedSlot || createBooking.isPending}>
                {createBooking.isPending
                  ? 'Записываем…'
                  : selectedSlot
                    ? `Записаться на ${formatUtcDateTime(selectedSlot.startsAt)} UTC`
                    : 'Сначала выберите время'}
              </Button>
            </form>
          </Form>
        </section>
      )}
    </div>
  )
}
