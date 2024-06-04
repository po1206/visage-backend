#! /bin/bash
if [ $# -eq 0 -o -z "$1" ]
  then
    echo "No arguments supplied"
    exit 1
fi
MONGO_CONTAINER=$(docker ps | grep mongo-visage | awk '{print $1}')
docker exec -i $MONGO_CONTAINER mongodump --db visage --archive > ./fixtures/$1