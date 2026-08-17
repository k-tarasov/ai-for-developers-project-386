import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { components } from './schema'

export type EventType = components['schemas']['EventType']
export type WeeklySchedule = components['schemas']['WeeklySchedule']
export type TimeInterval = components['schemas']['TimeInterval']
export type Slot = components['schemas']['Slot']
export type Booking = components['schemas']['Booking']
export type BookingCreate = components['schemas']['BookingCreate']

export const queryKeys = {
  eventTypes: ['event-types'] as const,
  eventType: (id: string) => ['event-types', id] as const,
  slots: (eventTypeId: string) => ['slots', eventTypeId] as const,
  schedule: ['schedule'] as const,
  bookings: ['bookings'] as const,
}

const delay = <T>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

const iso = (d: Date): string => d.toISOString()

function addMinutes(d: Date, minutes: number): Date {
  const next = new Date(d)
  next.setMinutes(next.getMinutes() + minutes)
  return next
}

const MOCK_EVENT_TYPES: EventType[] = [
  {
    id: 'intro-call',
    title: 'Знакомственный звонок',
    description: 'Короткая встреча, чтобы обсудить сотрудничество и познакомиться.',
    durationMinutes: 30,
  },
  {
    id: 'strategy-session',
    title: 'Стратегическая сессия',
    description: 'Глубокий разбор задач и плана работ на ближайший месяц.',
    durationMinutes: 60,
  },
  {
    id: 'tech-review',
    title: 'Технический ревью',
    description: 'Разбор архитектуры и кода вашего проекта.',
    durationMinutes: 45,
    availability: {
      mon: [{ start: '10:00', end: '14:00' }],
      tue: [],
      wed: [{ start: '09:00', end: '12:00' }],
      thu: [{ start: '09:00', end: '12:00' }],
      fri: [],
      sat: [],
      sun: [],
    },
  },
]

const MOCK_SCHEDULE: WeeklySchedule = {
  mon: [{ start: '09:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '15:00' }],
  sat: [],
  sun: [],
}

const MOCK_BOOKINGS: Booking[] = (() => {
  const now = new Date()
  const base = new Date(now)
  base.setDate(base.getDate() + 1)
  base.setHours(10, 0, 0, 0)
  const et = MOCK_EVENT_TYPES[0]
  return [
    {
      id: '00000000-0000-0000-0000-000000000001',
      eventType: { id: et.id, title: et.title, durationMinutes: et.durationMinutes },
      startsAt: iso(base),
      endsAt: iso(addMinutes(base, et.durationMinutes)),
      guestName: 'Иван Иванов',
      guestEmail: 'ivan@example.com',
      guestComment: 'Хочу узнать подробности.',
      createdAt: iso(addMinutes(now, -30)),
    },
  ]
})()

function buildSlots(eventTypeId: string): components['schemas']['SlotsResponse'] {
  const et = MOCK_EVENT_TYPES.find((e) => e.id === eventTypeId)
  const duration = et?.durationMinutes ?? 30
  const now = new Date()
  const windowStartsOn = new Date(now)
  windowStartsOn.setHours(0, 0, 0, 0)
  const windowEndsOn = addMinutes(windowStartsOn, 14 * 24 * 60)

  const slots: Slot[] = []
  for (let day = 0; day < 14; day++) {
    const start = new Date(windowStartsOn)
    start.setDate(start.getDate() + day)
    start.setHours(9, 0, 0, 0)
    const endOfDay = new Date(start)
    endOfDay.setHours(17, 0, 0, 0)
    while (addMinutes(start, duration) <= endOfDay) {
      slots.push({ startsAt: iso(start), endsAt: iso(addMinutes(start, duration)) })
      start.setMinutes(start.getMinutes() + 30)
    }
  }

  return {
    windowStartsOn: windowStartsOn.toISOString().slice(0, 10),
    windowEndsOn: windowEndsOn.toISOString().slice(0, 10),
    slots,
  }
}

export function useEventTypes() {
  return useQuery({
    queryKey: queryKeys.eventTypes,
    queryFn: () => delay(MOCK_EVENT_TYPES),
  })
}

export function useEventType(eventTypeId: string) {
  return useQuery({
    queryKey: queryKeys.eventType(eventTypeId),
    queryFn: () => {
      const found = MOCK_EVENT_TYPES.find((e) => e.id === eventTypeId)
      if (!found) {
        return Promise.reject(new Error(`EVENT_TYPE_NOT_FOUND: ${eventTypeId}`))
      }
      return delay(found)
    },
  })
}

export function useSlots(eventTypeId: string) {
  return useQuery({
    queryKey: queryKeys.slots(eventTypeId),
    queryFn: () => delay(buildSlots(eventTypeId)),
  })
}

export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: () => delay(MOCK_SCHEDULE),
  })
}

export function useBookings() {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: () => delay(MOCK_BOOKINGS),
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: BookingCreate) => {
      const et = MOCK_EVENT_TYPES.find((e) => e.id === body.eventTypeId)
      const booking: Booking = {
        id: '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0'),
        eventType: {
          id: et?.id ?? body.eventTypeId,
          title: et?.title ?? body.eventTypeId,
          durationMinutes: et?.durationMinutes ?? 30,
        },
        startsAt: body.startsAt,
        endsAt: body.startsAt,
        guestName: body.guestName,
        guestPhone: body.guestPhone,
        guestEmail: body.guestEmail,
        guestComment: body.guestComment,
        createdAt: iso(new Date()),
      }
      return delay(booking)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.slots(variables.eventTypeId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

export function useCreateEventType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: EventType) => delay(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes })
    },
  })
}

export function useUpdateEventType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ eventTypeId, body }: { eventTypeId: string; body: EventType }) => {
      void eventTypeId
      return delay(body)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes })
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventType(variables.eventTypeId) })
    },
  })
}

export function useDeleteEventType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventTypeId: string) => {
      void eventTypeId
      return delay(undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: WeeklySchedule) => delay(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule })
    },
  })
}
