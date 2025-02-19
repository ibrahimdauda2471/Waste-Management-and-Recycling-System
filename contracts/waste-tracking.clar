;; Waste Tracking Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))

;; Data Variables
(define-data-var last-waste-id uint u0)

;; Data Maps
(define-map waste-records
  { waste-id: uint }
  {
    generator: principal,
    waste-type: (string-ascii 20),
    amount: uint,
    timestamp: uint,
    disposed: bool
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

;; Record waste generation
(define-public (record-waste-generation (waste-type (string-ascii 20)) (amount uint))
  (let
    (
      (new-id (+ (var-get last-waste-id) u1))
    )
    (map-set waste-records
      { waste-id: new-id }
      {
        generator: tx-sender,
        waste-type: waste-type,
        amount: amount,
        timestamp: block-height,
        disposed: false
      }
    )
    (var-set last-waste-id new-id)
    (ok new-id)
  )
)

;; Record waste disposal
(define-public (record-waste-disposal (waste-id uint))
  (let
    (
      (waste (unwrap! (map-get? waste-records { waste-id: waste-id }) err-not-found))
    )
    (asserts! (is-authorized-collector tx-sender) err-unauthorized)
    (asserts! (not (get disposed waste)) err-unauthorized)
    (ok (map-set waste-records
      { waste-id: waste-id }
      (merge waste { disposed: true })
    ))
  )
)

;; Read-only functions

;; Get waste record
(define-read-only (get-waste-record (waste-id uint))
  (ok (unwrap! (map-get? waste-records { waste-id: waste-id }) err-not-found))
)

;; Check if a collector is authorized
(define-read-only (is-authorized-collector (collector principal))
  (default-to false (get authorized (map-get? authorized-collectors { collector: collector })))
)

;; Initialize contract
(begin
  (var-set last-waste-id u0)
)
