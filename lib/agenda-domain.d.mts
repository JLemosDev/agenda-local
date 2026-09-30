export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}
export interface Professional {
  id: string;
  name: string;
}
export interface BookingInput {
  client: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
  notes?: string;
}
export const SERVICES: readonly Service[];
export const PROFESSIONALS: readonly Professional[];
export class AgendaError extends Error {
  status: number;
  constructor(message: string, status?: number);
}
export function businessNow(now?: Date): { date: string; minute: number };
export function validDate(date: string): Date;
export function defaultDate(now?: Date): string;
export function timeToMinute(time: string): number;
export function minuteToTime(minute: number): string;
export function getService(id: string): Service;
export function getProfessional(id: string): Professional;
export function validateDay(
  date: string,
  now?: Date,
): { date: string; minute: number };
export function validateBooking(
  input: unknown,
  now?: Date,
): {
  client: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  notes: string;
};
export function occupancyMinutes(start: number, end: number): number[];
export function availableSlots(
  date: string,
  serviceId: string,
  professionalId: string,
  occupied?: number[],
  now?: Date,
): string[];
