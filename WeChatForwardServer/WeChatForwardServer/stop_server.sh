#!/bin/bash

echo "stopping wechat...."
pid=`ps -ef|grep node |grep -v grep |awk '{print $2}'|head -1`
while [ "$pid" != "" ]; do
	echo "kill -9 $pid"
	kill -9 $pid
	pid=`ps -ef|grep node |grep -v grep |awk '{print $2}'|head -1`
done
