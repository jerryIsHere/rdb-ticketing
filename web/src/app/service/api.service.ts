import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { UserSessionService } from './user-session.service';
import { Observable, catchError, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';


type HttpClientLike = {
  get: (url: string, options?: {
    headers?: HttpHeaders | {
      [header: string]: string | string[];
    };
    context?: HttpContext;
    observe?: 'body';
    params?: HttpParams | {
      [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
    };
    reportProgress?: boolean;
    responseType?: 'json';
    withCredentials?: boolean;
    transferCache?: {
      includeHeaders?: string[];
    } | boolean;
  }) => Observable<Object>,

  post: (url: string, body: any | null, options?: {
    headers?: HttpHeaders | {
      [header: string]: string | string[];
    };
    context?: HttpContext;
    observe?: 'body';
    params?: HttpParams | {
      [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
    };
    reportProgress?: boolean;
    responseType?: 'json';
    withCredentials?: boolean;
    transferCache?: {
      includeHeaders?: string[];
    } | boolean;
  }) => Observable<Object>,

  patch: (url: string, body: any | null, options?: {
    headers?: HttpHeaders | {
      [header: string]: string | string[];
    };
    context?: HttpContext;
    observe?: 'body';
    params?: HttpParams | {
      [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
    };
    reportProgress?: boolean;
    responseType?: 'json';
    withCredentials?: boolean;
  }) => Observable<Object>,
  delete: (url: string, options?: {
    headers?: HttpHeaders | {
      [header: string]: string | string[];
    };
    context?: HttpContext;
    observe?: 'body';
    params?: HttpParams | {
      [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
    };
    reportProgress?: boolean;
    responseType?: 'json';
    withCredentials?: boolean;
    body?: any | null;
  }) => Observable<Object>
}
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  //static readonly endpoint: string = location.origin.includes("localhost") ? "http://localhost:3000" : "https://micro-ticketing-api.vercel.app"
  public user: UserApi
  public request: HttpClientLike
  constructor(private httpClient: HttpClient, public userSession: UserSessionService, public snackBar: MatSnackBar) {
    this.request = {
      get: (url: string, options?: {
        headers?: HttpHeaders | {
          [header: string]: string | string[];
        };
        context?: HttpContext;
        observe?: 'body';
        params?: HttpParams | {
          [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
        };
        reportProgress?: boolean;
        responseType?: 'json';
        withCredentials?: boolean;
        transferCache?: {
          includeHeaders?: string[];
        } | boolean;
      }) => {
        return this.httpClient.get(url, options).pipe(
          catchError((errResponse: HttpErrorResponse) => {
            console.log(errResponse)
            if (errResponse.error && errResponse.error.reason) {
              this.snackBar.open(errResponse.error.reason, "ok");
            }
            return of([])
          })
        )
      },

      post: (url: string, body: any | null, options?: {
        headers?: HttpHeaders | {
          [header: string]: string | string[];
        };
        context?: HttpContext;
        observe?: 'body';
        params?: HttpParams | {
          [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
        };
        reportProgress?: boolean;
        responseType?: 'json';
        withCredentials?: boolean;
        transferCache?: {
          includeHeaders?: string[];
        } | boolean;
      }) => {
        return this.httpClient.post(url, body, options).pipe(
          catchError((errResponse: HttpErrorResponse) => {
            console.log(errResponse)
            if (errResponse.error && errResponse.error.reason) {
              this.snackBar.open(errResponse.error.reason, "ok");
            }
            return of([])
          })
        )
      },

      patch: (url: string, body: any | null, options?: {
        headers?: HttpHeaders | {
          [header: string]: string | string[];
        };
        context?: HttpContext;
        observe?: 'body';
        params?: HttpParams | {
          [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
        };
        reportProgress?: boolean;
        responseType?: 'json';
        withCredentials?: boolean;
      }) => {
        return this.httpClient.patch(url, body, options).pipe(
          catchError((errResponse: HttpErrorResponse) => {
            console.log(errResponse)
            if (errResponse.error && errResponse.error.reason) {
              this.snackBar.open(errResponse.error.reason, "ok");
            }
            return of([])
          })
        )
      },
      delete: (url: string, options?: {
        headers?: HttpHeaders | {
          [header: string]: string | string[];
        };
        context?: HttpContext;
        observe?: 'body';
        params?: HttpParams | {
          [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
        };
        reportProgress?: boolean;
        responseType?: 'json';
        withCredentials?: boolean;
        body?: any | null;
      }) => {
        return this.httpClient.delete(url, options).pipe(
          catchError((errResponse: HttpErrorResponse) => {
            console.log(errResponse)
            if (errResponse.error && errResponse.error.reason) {
              this.snackBar.open(errResponse.error.reason, "ok");
            }
            return of([])
          })
        )
      }
    }
    this.user = new UserApi(this.request, userSession)
  }
}

class UserApi {

  constructor(public httpClient: HttpClientLike, public userSession: UserSessionService,) { }
  register(user: {
    username: string;
    fullname: string;
    email: string;
    singingPart: string;
    password: string
  }) {
    return this.httpClient.post("/user?register", user).toPromise().then((result: any) => {
      if (result && result.success) {
        this.userSession.checkUserSession();
        return result
      }
    });
  }
  login(credential: {
    username: string;
    password: string
  }) {
    return this.httpClient.post(`/user?login`, credential).toPromise().then((result: any) => {
      if (result && result.success) {
        this.userSession.checkUserSession();
        return result
      }
    });

  }
  logout() {
    return this.httpClient.post(`/user?logout`, {}).toPromise().then((result: any) => {
      if (result && result.success) {
        this.userSession.checkUserSession();
        location.reload()
        return
      }
    });
  }
}