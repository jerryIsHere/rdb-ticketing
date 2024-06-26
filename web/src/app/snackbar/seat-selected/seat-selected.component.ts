import { Component, Inject } from '@angular/core';
import { PriceTier, Seat, Ticket } from '../../interface';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../service/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-seat-selected',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './seat-selected.component.html',
  styleUrl: './seat-selected.component.sass'
})
export class SeatSelectedComponent {
  constructor(
    public snackRef: MatSnackBarRef<SeatSelectedComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: {
      seats: Seat[] | undefined,
      tickets: Ticket[],
      selectedSeatIds: string[],
      priceTiers: PriceTier[] | undefined,
      priceTiersColors?: Map<string, string>,
      eventId?: string | undefined
    }, private api: ApiService, private router: Router) {
    router.events.subscribe((_) => {
      snackRef.dismiss()
    })
  }
  sellAt(priceTier: PriceTier) {
    if (this.data.seats && this.data.eventId) {
      console.log(this.data.selectedSeatIds, this.data.tickets)
      let promise: Promise<any>[] = []
      let existing: string[] = this.data.selectedSeatIds.filter(seatId => this.data.tickets.filter(t => t.seatId == seatId).length > 0)
        .map(seatId => this.data.tickets.filter(t => t.seatId == seatId)[0]._id)
      let missing: string[] = this.data.selectedSeatIds.filter(seatId => this.data.tickets.filter(t => t.seatId == seatId).length == 0)


      console.log(missing.map(seatId => {
        return { seatId: seatId, eventId: this.data.eventId, priceTierId: priceTier._id }
      }))
      if (missing.length > 0) {
        missing.reduce((chunk: string[][], id, i) => {
          if (chunk[chunk.length - 1].length < 50) {
            chunk[chunk.length - 1].push(id)
          }
          else {
            chunk.push([id])
          }
          return chunk
        }, [[]]).forEach(ids => {
          promise.push(this.api.request.post(`/ticket?batch&create`, {
            tickets: ids.map(seatId => {
              return { seatId: seatId, eventId: this.data.eventId, priceTierId: priceTier._id }
            })
          },).toPromise().then((result: any) => {
            if (result && result.success) {
            }
          }))
        })
      }
      if (existing.length > 0) {
        existing.reduce((chunk: string[][], id, i) => {
          if (chunk[chunk.length - 1].length < 50) {
            chunk[chunk.length - 1].push(id)
          }
          else {
            chunk.push([id])
          }
          return chunk
        }, [[]]).forEach(ids => {
          promise.push(this.api.request.patch(`/ticket?batch&priceTier=${priceTier._id}`, {
            ticketIds: ids
          },).toPromise().then((result: any) => {
            if (result && result.success) {
            }
          }))
        })
      }
      Promise.all(promise).then(_ => {
        this.snackRef.dismiss();
      })
      this.doing = true
    }
  }
  doing: boolean = false;
  removeTickets() {
    if (this.data.seats && this.data.eventId) {
      let existing: string[] = this.data.selectedSeatIds.filter(seatId => this.data.tickets.filter(t => t.seatId == seatId).length > 0)
        .map(seatId => this.data.tickets.filter(t => t.seatId == seatId)[0]._id)
      if (existing.length > 0) {
        existing.reduce((chunk: string[][], id, i) => {
          if (chunk[chunk.length - 1].length < 50) {
            chunk[chunk.length - 1].push(id)
          }
          else {
            chunk.push([id])
          }
          return chunk
        }, [[]])
        this.api.request.delete(`/ticket?batch`, {
          body: {
            ticketIds: existing
          }
        },).toPromise().then((result: any) => {
          if (result && result.success) {
            this.snackRef.dismiss();
          }
        })
        this.doing = true
      }
    }
  }


}
