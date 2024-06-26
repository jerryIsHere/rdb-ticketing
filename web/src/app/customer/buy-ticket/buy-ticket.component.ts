import { Component, Input, ViewChild } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDialog } from '@angular/material/dialog';
import { Show, Venue, Ticket, Seat, PriceTier, isShowSelling, isShowSellingAsFirstRound, isShowSellingAsSecondROund } from '../../interface';
import { SeatFormComponent } from '../../forms/seat-form/seat-form.component';
import { SeatingPlanComponent } from '../../seatUI/seating-plan/seating-plan.component';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon'
import { UserSessionService } from '../../service/user-session.service';
import { TicketSelectedComponent } from '../../snackbar/ticket-selected/ticket-selected.component';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

const defaultShoppingCartSize = 6
@Component({
  selector: 'app-buy-ticket',
  standalone: true,
  imports: [MatGridListModule, MatButtonModule, SeatingPlanComponent, DatePipe, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './buy-ticket.component.html',
  styleUrl: './buy-ticket.component.sass'
})
export class BuyTicketComponent {
  seats: Seat[] | undefined
  tickets: Ticket[] = []
  _id: string | undefined
  event: Show | undefined
  venue: Venue | undefined
  @ViewChild('seatingPlan') seatingPlan?: SeatingPlanComponent;
  priceTiers: PriceTier[] | undefined
  @Input()
  set id(id: string) {
    this._id = id
    if (id && this.userSession.user) this.loadData(id)
  }

  constructor(private api: ApiService, public dialog: MatDialog, public userSession: UserSessionService,
    private _snackBar: MatSnackBar) {
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
        if (this.event && this.event.shoppingCartSize) {
          let quota = isShowSellingAsFirstRound(this.event) ? this.event.firstRoundTicketQuota : isShowSellingAsSecondROund(this.event) ? this.event.secondRoundTicketQuota : undefined
          this.shoppingCartSize = quota != undefined && Number(this.event.shoppingCartSize) > Number(quota) ? quota : this.event.shoppingCartSize != undefined ? this.event.shoppingCartSize : defaultShoppingCartSize
          this.shoppingCartSize = this.shoppingCartSize < 0 ? defaultShoppingCartSize : this.shoppingCartSize
        }
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
  sectionSelectedSeatIds: Set<string> = new Set<string>()
  shoppingCartSize: number = defaultShoppingCartSize
  checkAction() {
    let tickets: Ticket[] = [];
    [...this.seatingPlan && this.seatingPlan.selectedSeatIds ? Array.from(this.seatingPlan.selectedSeatIds.values()) : [],
    ...this.outsideSelectedSeat.map(seat => seat._id)
    ].map(sid => this.tickets.find(t => t.seatId == sid)).filter(ticket => ticket != undefined).forEach(t => {
      if (t && !(t.occupant || t.occupied))
        tickets.push(t)
    })
    let seatInfo = this.outsideSelectedSeat.map(seat => { return { seat: seat, ticket: this.tickets.find(t => t.seatId == seat._id) } })
      .map(seatNticket => { return { ...seatNticket, ...{ priceTier: this.priceTiers?.find(p => p._id == seatNticket.ticket?.priceTierId) } } })
      .map(info => info.seat.row + info.seat.no + (info.priceTier && info.priceTier?.tierName ? `(${info.priceTier?.tierName})` : ""))
    let action = {
      tickets: tickets,
      limit: this.shoppingCartSize,
      seatInfo: seatInfo,
      success: false,
      reload: false,
    }
    if (this.actionSnackbarRef == undefined && this.seatingPlan) {
      this.actionSnackbarRef = this._snackBar.openFromComponent(TicketSelectedComponent, {
        data: action
      });
      this.actionSnackbarRef.afterDismissed().subscribe((response) => {
        this.actionSnackbarRef = undefined
        if (this._id) {
          // commenting this because this exhause server resources
           if(!action.success)this.loadData(this._id);
        }
        this.seatingPlan?.clearSelectedSeat()
      });
    }
    else if (this.actionSnackbarRef && this.seatingPlan) {
      if (tickets.length == 0) {
        this.actionSnackbarRef.dismiss()
      }
      else {
        this.actionSnackbarRef.instance.data.tickets = tickets
        this.actionSnackbarRef.instance.data.seatInfo = seatInfo
      }
    }
  }
  outsideSelectedSeat: Seat[] = []
  openForm(checkSection: Boolean = true) {
    if (this._id && this.seatingPlan?.selectedSection) {
      const dialogRef = this.dialog.open(SeatFormComponent, {
        data: { _id: this._id },
        autoFocus: false
      });
      dialogRef.afterClosed().subscribe((rowsNcols: { row: string, no: string }[]) => {
        let avalibleSeat: any[] = rowsNcols.map((rc) => {
          let seat = this.seats?.filter(s => s.row == rc.row && s.no == Number(rc.no))
          if (seat && seat.length > 0) {
            return seat[0]
          }
          else {
            return null
          }
        }).filter((seat) => seat != null && this.seatingPlan && this.seatingPlan.getTiceket(seat._id) != null && this.seatingPlan.getBuyer(seat._id) == null)
        let seatInside: any[] = avalibleSeat.filter(s => s.coord.sectX == this.seatingPlan?.selectedSection?.x && s.coord.sectY == this.seatingPlan?.selectedSection?.y)
        if (!checkSection) {
          this.outsideSelectedSeat = avalibleSeat.filter(s => !(s.coord.sectX == this.seatingPlan?.selectedSection?.x && s.coord.sectY == this.seatingPlan?.selectedSection?.y))
        }
        else {
          this.outsideSelectedSeat = [];
        }
        this.sectionSelectedSeatIds = new Set<string>(seatInside.map(seat => seat._id))
        this.checkAction()
      })
    }
  }
  clearAction() {
    this.seatingPlan?.clearSelectedSeat();
    this.outsideSelectedSeat = [];
  }
  isShowSelling(show: Show) {
    return isShowSelling(show)
  }

}


