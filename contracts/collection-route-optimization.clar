;; Collection Route Optimization Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))

;; Data Variables
(define-data-var last-route-id uint u0)

;; Data Maps
(define-map collection-routes
  { route-id: uint }
  {
    collector: principal,
    start-location: (string-utf8 100),
    end-location: (string-utf8 100),
    waypoints: (list 20 (string-utf8 100)),
    estimated-time: uint,
    status: (string-ascii 20)
  }
)

(define-map authorized-collectors
  { collector: principal }
  { authorized: bool }
)

;; Public Functions

;; Authorize a waste collector
(define-public (authorize-collector (collector principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set authorized-collectors { collector: collector } { authorized: true }))
  )
)

;; Create a new collection route
(define-public (create-route (start-location (string-utf8 100)) (end-location (string-utf8 100)) (waypoints (list 20 (string-utf8 100))) (estimated-time uint))
  (let
    (
      (new-id (+ (var-get last-route-id) u1))
    )
    (asserts! (is-authorized-collector tx-sender) err-unauthorized)
    (map-set collection-routes
      { route-id: new-id }
      {
        collector: tx-sender,
        start-location: start-location,
        end-location: end-location,
        waypoints: waypoints,
        estimated-time: estimated-time,
        status: "pending"
      }
    )
    (var-set last-route-id new-id)
    (ok new-id)
  )
)

;; Update route status
(define-public (update-route-status (route-id uint) (new-status (string-ascii 20)))
  (let
    (
      (route (unwrap! (map-get? collection-routes { route-id: route-id }) err-not-found))
    )
    (asserts! (is-eq (get collector route) tx-sender) err-unauthorized)
    (ok (map-set collection-routes
      { route-id: route-id }
      (merge route { status: new-status })
    ))
  )
)

;; Read-only functions

;; Get route details
(define-read-only (get-route (route-id uint))
  (ok (unwrap! (map-get? collection-routes { route-id: route-id }) err-not-found))
)

;; Check if a collector is authorized
(define-read-only (is-authorized-collector (collector principal))
  (default-to false (get authorized (map-get? authorized-collectors { collector: collector })))
)

;; Initialize contract
(begin
  (var-set last-route-id u0)
)

