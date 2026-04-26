package main

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func main() {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   "8120cbac-9fc5-4210-a560-3f1da43e5443",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	s, _ := token.SignedString([]byte("echoes_dev_secret_key_change_in_production"))
	fmt.Println(s)
}
