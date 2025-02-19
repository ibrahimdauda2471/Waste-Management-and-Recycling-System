;; Recycling Incentive Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))

;; Data Variables
(define-data-var last-recycling-id uint u0)

;; Data Maps
(define-map recycling-records
  { recycling-id: uint }
  {
    recycler: principal,
    waste-type: (string-ascii 20),
    amount: uint,
    timestamp: uint,
    verified: bool
  }
)

(define-map recycling-points
  { recycler: principal }
  { points: uint }
)

(define-map authorized-verifiers
  { verifier: principal }
  { authorized: bool }
)

;; Public Functions

;; Authorize a recycling verifier
(define-public (authorize-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set authorized-verifiers { verifier: verifier } { authorized: true }))
  )
)

;; Record recycling activity
(define-public (record-recycling (waste-type (string-ascii 20)) (amount uint))
  (let
    (
      (new-id (+ (var-get last-recycling-id) u1))
    )
    (map-set recycling-records
      { recycling-id: new-id }
      {
        recycler: tx-sender,
        waste-type: waste-type,
        amount: amount,
        timestamp: block-height,
        verified: false
      }
    )
    (var-set last-recycling-id new-id)
    (ok new-id)
  )
)

;; Verify recycling activity and award points
(define-public (verify-recycling (recycling-id uint))
  (let
    (
      (recycling (unwrap! (map-get? recycling-records { recycling-id: recycling-id }) err-not-found))
      (current-points (default-to { points: u0 } (map-get? recycling-points { recycler: (get recycler recycling) })))
    )
    (asserts! (is-authorized-verifier tx-sender) err-unauthorized)
    (asserts! (not (get verified recycling)) err-unauthorized)
    (map-set recycling-records
      { recycling-id: recycling-id }
      (merge recycling { verified: true })
    )
    (map-set recycling-points
      { recycler: (get recycler recycling) }
      { points: (+ (get points current-points) (get amount recycling)) }
    )
    (ok true)
  )
)

;; Read-only functions

;; Get recycling record
(define-read-only (get-recycling-record (recycling-id uint))
  (ok (unwrap! (map-get? recycling-records { recycling-id: recycling-id }) err-not-found))
)

;; Get recycler's points
(define-read-only (get-recycler-points (recycler principal))
  (ok (get points (default-to { points: u0 } (map-get? recycling-points { recycler: recycler }))))
)

;; Check if a verifier is authorized
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false (get authorized (map-get? authorized-verifiers { verifier: verifier })))
)

;; Initialize contract
(begin
  (var-set last-recycling-id u0)
)
