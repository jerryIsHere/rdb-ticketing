import { Component, Input, ViewChild } from '@angular/core';
import { ApiService } from '../service/api.service';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDialog } from '@angular/material/dialog';
import { Event, Venue } from '../management-panel/management-panel.component';
import { SeatFormComponent } from '../forms/seat-form/seat-form.component';
import { SeatingPlanComponent, Ticket } from '../seatUI/seating-plan/seating-plan.component';
import { Seat } from '../seatUI/seating-plan/seating-plan.component';;
import { MatButtonModule } from '@angular/material/button';
import { PriceTier } from '../management-panel/management-panel.component';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { UserSessionService } from '../service/user-session.service';
import { TicketSelectedComponent } from '../snackbar/ticket-selected/ticket-selected.component';

@Component({
  selector: 'app-buy-ticket',
  standalone: true,
  imports: [MatGridListModule, MatButtonModule, SeatingPlanComponent],
  templateUrl: './buy-ticket.component.html',
  styleUrl: './buy-ticket.component.sass'
})
export class BuyTicketComponent {
  seats: Seat[] | undefined
  tickets: Ticket[] = []
  _id: string | undefined
  event: Event | undefined
  venue: Venue | undefined
  @ViewChild('seatingPlan') seatingPlan?: SeatingPlanComponent;
  priceTiers: PriceTier[] | undefined
  @Input()
  set id(id: string) {
    this._id = id
    if (id) this.loadData(id)
  }

  constructor(private api: ApiService, public dialog: MatDialog, public userSession: UserSessionService, private _snackBar: MatSnackBar) {
    this.api.request.get("/priceTier?list").toPromise().then((result: any) => {
      if (result && result.data)
        this.priceTiers = result.data
    })
  }
  loadData(id: string) {
    var promises: Promise<any>[] = []
    this.api.request.get(`/event/${this._id}`).toPromise().then((result: any) => {
      if (result && result.data) {
        this.event = result.data
        return result.data
      }
    }).then((event) => {
      if (event) {
        this.api.request.get(`/seat?venueId=${event.venueId}`).toPromise().then((result: any) => {
          if (result && result.data) {
            this.seats = result.data
          }
        })
        this.api.request.get(`/venue/${event.venueId}`).toPromise().then((result: any) => {
          if (result && result.data) {
            this.venue = result.data
          }
        })
      }
    })
    this.api.request.get(`/ticket?eventId=${this._id}`).toPromise().then((result: any) => {
      if (result && result.data) {
        this.tickets = result.data
      }
    })
  }
  actionSnackbarRef?: MatSnackBarRef<TicketSelectedComponent>
  selectedSeatIds: Set<string> = new Set<string>()

  checkAction() {
    let tickets: Ticket[] = []
    Array.from(this.selectedSeatIds.values()).map(sid => this.tickets.find(t => t.seatId == sid)).filter(ticket => ticket != undefined).forEach(t => {
      if (t && !(t.occupant || t.occupied))
        tickets.push(t)
    })
    if (this.actionSnackbarRef == undefined && this.seatingPlan) {
      this.actionSnackbarRef = this._snackBar.openFromComponent(TicketSelectedComponent, {
        data: {
          tickets: tickets,
        }
      });
      this.actionSnackbarRef.afterDismissed().subscribe(() => {
        this.actionSnackbarRef = undefined
        if (this._id)
          this.loadData(this._id);
      });
    }
    else if (this.actionSnackbarRef && this.seatingPlan) {
      this.actionSnackbarRef.instance.data.tickets = tickets
    }
  }
  openForm() {
    if (this._id && this.seatingPlan?.selectedSection) {
      const dialogRef = this.dialog.open(SeatFormComponent, {
        data: { _id: this._id }
      });
      dialogRef.afterClosed().subscribe((rowsNcols: { row: string, no: string }[]) => {
        let seatIds: string[] = []
        rowsNcols.forEach((rc) => {
          let seat = this.seats?.filter(s => s.row == rc.row && s.no == Number(rc.no) &&
            s.coord.sectX == this.seatingPlan?.selectedSection?.x && s.coord.sectY == this.seatingPlan?.selectedSection?.y)
          if (seat && seat.length > 0) {
            seatIds.push(seat[0]._id)
          }
        })
        if (this.seatingPlan) {
          this.selectedSeatIds = new Set<string>(seatIds)
          this.checkAction()
        }
      })
    }
  }
}


